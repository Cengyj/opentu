'use strict';

const path = require('path');

const STATIC_IMPORT_PATTERN =
  /(?:\bimport\s*(?:[^"'`]*?\bfrom\s*)?|\bexport\s*[^"'`]*?\bfrom\s*)["']([^"']+)["']/g;
const DYNAMIC_IMPORT_PATTERN = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
const VITE_MAP_DEPS_PATTERN = /\b__vite__mapDeps\(\s*\[([^\]]*)\]\s*\)/;

function isRelativeAssetReference(reference) {
  return reference.startsWith('./') || reference.startsWith('../');
}

function resolveAssetReference(importerAsset, reference) {
  if (!isRelativeAssetReference(reference)) {
    return null;
  }

  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(importerAsset), reference)
  );
  if (resolved === '..' || resolved.startsWith('../')) {
    throw new Error(
      `资源引用越过构建目录边界：${importerAsset} -> ${reference}`
    );
  }

  return resolved;
}

function readJsonArrayLiteral(source, openingBracketIndex) {
  if (source[openingBracketIndex] !== '[') {
    return null;
  }

  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = openingBracketIndex; index < source.length; index += 1) {
    const character = source[index];

    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === '[') {
      depth += 1;
      continue;
    }

    if (character === ']') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openingBracketIndex, index + 1);
      }
    }
  }

  return null;
}

function parseViteDependencyTable(source) {
  const helperIndex = source.indexOf('__vite__mapDeps');
  if (helperIndex < 0) {
    return null;
  }

  const helperSource = source.slice(helperIndex);
  const assignmentMatch = helperSource.match(
    /[\w$]+\.f\s*\|\|\s*\(\s*[\w$]+\.f\s*=\s*/
  );
  if (!assignmentMatch || assignmentMatch.index === undefined) {
    return null;
  }

  const openingBracketIndex =
    helperIndex + assignmentMatch.index + assignmentMatch[0].length;
  const literal = readJsonArrayLiteral(source, openingBracketIndex);
  if (literal === null) {
    throw new Error('无法读取 __vite__mapDeps 依赖表');
  }

  let dependencyTable;
  try {
    dependencyTable = JSON.parse(literal);
  } catch (error) {
    throw new Error(
      `无法解析 __vite__mapDeps 依赖表：${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (
    !Array.isArray(dependencyTable) ||
    dependencyTable.some((dependency) => typeof dependency !== 'string')
  ) {
    throw new Error('__vite__mapDeps 依赖表必须是字符串数组');
  }

  return dependencyTable;
}

function parseViteMapIndexes(indexSource) {
  const trimmed = indexSource.trim();
  if (trimmed === '') {
    return [];
  }

  return trimmed.split(',').map((value) => {
    const normalizedValue = value.trim();
    if (!/^\d+$/.test(normalizedValue)) {
      throw new Error(`__vite__mapDeps 包含无效索引：${normalizedValue}`);
    }
    return Number.parseInt(normalizedValue, 10);
  });
}

function collectStaticImportAssets(source, importerAsset) {
  const imports = new Set();

  for (const match of source.matchAll(STATIC_IMPORT_PATTERN)) {
    const importedAsset = resolveAssetReference(importerAsset, match[1]);
    if (importedAsset !== null) {
      imports.add(importedAsset);
    }
  }

  return imports;
}

function collectDynamicImportRecords(source, importerAsset) {
  const matches = Array.from(source.matchAll(DYNAMIC_IMPORT_PATTERN));
  if (matches.length === 0) {
    return [];
  }

  const dependencyTable = parseViteDependencyTable(source);

  return matches.flatMap((match, matchIndex) => {
    if (match.index === undefined) {
      return [];
    }

    const importedAsset = resolveAssetReference(importerAsset, match[1]);
    if (importedAsset === null) {
      return [];
    }

    const associationStart = match.index + match[0].length;
    const associationEnd = matches[matchIndex + 1]?.index ?? source.length;
    const associationSource = source.slice(associationStart, associationEnd);
    const mappedCall = associationSource.match(VITE_MAP_DEPS_PATTERN);

    if (!mappedCall) {
      return [{ asset: importedAsset, mappedDependencies: [] }];
    }

    if (dependencyTable === null) {
      throw new Error(
        `${importerAsset} 使用 __vite__mapDeps，但没有可解析的依赖表`
      );
    }

    const mappedDependencies = parseViteMapIndexes(mappedCall[1]).map(
      (dependencyIndex) => {
        const dependency = dependencyTable[dependencyIndex];
        if (dependency === undefined) {
          throw new Error(
            `${importerAsset} 的 __vite__mapDeps 索引越界：${dependencyIndex}`
          );
        }

        const resolvedDependency = resolveAssetReference(
          importerAsset,
          dependency
        );
        if (resolvedDependency === null) {
          throw new Error(
            `${importerAsset} 的 __vite__mapDeps 包含非相对资源：${dependency}`
          );
        }
        return resolvedDependency;
      }
    );

    return [{ asset: importedAsset, mappedDependencies }];
  });
}

function collectStaticImports(entryAsset, readAsset, visited = new Set()) {
  if (visited.has(entryAsset)) {
    return visited;
  }
  visited.add(entryAsset);

  const source = readAsset(entryAsset);
  if (source === null || !entryAsset.endsWith('.js')) {
    return visited;
  }

  for (const importedAsset of collectStaticImportAssets(source, entryAsset)) {
    collectStaticImports(importedAsset, readAsset, visited);
  }

  return visited;
}

function collectRequiredStartupGraph({
  entryAssets,
  readAsset,
  requiredDynamicPrefixes = [],
  requiredDynamicRootRules = [],
}) {
  const graph = new Set();
  const pendingDynamicRoots = [...entryAssets];
  const visitedDynamicRoots = new Set();
  const visitedDynamicImportSources = new Set();
  const rootRuleParentMatches = requiredDynamicRootRules.map(() => 0);

  while (pendingDynamicRoots.length > 0) {
    const rootAsset = pendingDynamicRoots.pop();
    if (!rootAsset || visitedDynamicRoots.has(rootAsset)) {
      continue;
    }

    visitedDynamicRoots.add(rootAsset);
    const staticGraph = collectStaticImports(rootAsset, readAsset);
    staticGraph.forEach((asset) => graph.add(asset));

    for (const staticAsset of staticGraph) {
      if (visitedDynamicImportSources.has(staticAsset)) {
        continue;
      }
      visitedDynamicImportSources.add(staticAsset);

      const source = readAsset(staticAsset);
      if (source === null || !staticAsset.endsWith('.js')) {
        continue;
      }

      const dynamicImports = collectDynamicImportRecords(source, staticAsset);
      const requiredDynamicImports = new Set();

      for (const dynamicImport of dynamicImports) {
        const baseName = path.posix.basename(dynamicImport.asset);
        if (
          requiredDynamicPrefixes.some((prefix) => baseName.startsWith(prefix))
        ) {
          requiredDynamicImports.add(dynamicImport);
        }
      }

      requiredDynamicRootRules.forEach((rule, ruleIndex) => {
        const parentBaseName = path.posix.basename(staticAsset);
        if (!parentBaseName.startsWith(rule.parentPrefix)) {
          return;
        }

        rootRuleParentMatches[ruleIndex] += 1;
        const matches = dynamicImports.filter((dynamicImport) =>
          path.posix.basename(dynamicImport.asset).startsWith(rule.assetPrefix)
        );
        const expectedMatches = rule.expectedMatches ?? 1;
        if (matches.length !== expectedMatches) {
          throw new Error(
            `${staticAsset} 必须包含 ${expectedMatches} 个 ${rule.assetPrefix} 首屏动态根，实际为 ${matches.length}`
          );
        }
        matches.forEach((dynamicImport) =>
          requiredDynamicImports.add(dynamicImport)
        );
      });

      for (const dynamicImport of requiredDynamicImports) {
        dynamicImport.mappedDependencies.forEach((asset) => graph.add(asset));
        pendingDynamicRoots.push(dynamicImport.asset);
      }
    }
  }

  requiredDynamicRootRules.forEach((rule, ruleIndex) => {
    if (rootRuleParentMatches[ruleIndex] !== 1) {
      throw new Error(
        `必须存在唯一 ${rule.parentPrefix} 父资源以校验 ${rule.assetPrefix} 首屏动态根，实际为 ${rootRuleParentMatches[ruleIndex]}`
      );
    }
  });
  return graph;
}

function validateIdlePrefetchDefaults(manifest) {
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    Array.isArray(manifest)
  ) {
    throw new Error('idle prefetch manifest 必须是对象');
  }

  if (!Object.prototype.hasOwnProperty.call(manifest, 'defaults')) {
    throw new Error('idle prefetch manifest 缺少 defaults 数组');
  }

  if (!Array.isArray(manifest.defaults)) {
    throw new Error('idle prefetch manifest defaults 必须是数组');
  }

  if (manifest.defaults.length > 0) {
    throw new Error(
      `启动默认预取分组必须为空：${manifest.defaults.join(', ')}`
    );
  }

  return manifest.defaults;
}

module.exports = {
  collectDynamicImportRecords,
  collectRequiredStartupGraph,
  collectStaticImportAssets,
  collectStaticImports,
  parseViteDependencyTable,
  resolveAssetReference,
  validateIdlePrefetchDefaults,
};
