import type { ProviderHttpMethod, ProviderModelBinding } from './types';

const PROVIDER_HTTP_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

/**
 * Normalize endpoint metadata at the binding boundary. Unsupported methods
 * fail before transport so adapters never guess or silently replace them.
 */
export function normalizeProviderHttpMethod(
  value: unknown,
  fallback: ProviderHttpMethod
): ProviderHttpMethod {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized =
    typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!PROVIDER_HTTP_METHODS.has(normalized)) {
    throw new Error(`Unsupported provider HTTP method: ${String(value)}`);
  }
  return normalized as ProviderHttpMethod;
}

/**
 * Central compatibility edge for manually supplied/legacy in-memory bindings.
 * Every InvocationPlan receives an explicit submit method and, when polling,
 * an explicit poll method.
 */
export function normalizeProviderBindingHttpMethods(
  binding: ProviderModelBinding
): ProviderModelBinding {
  const submitMethod = normalizeProviderHttpMethod(binding.submitMethod, 'POST');
  const pollMethod = binding.pollPathTemplate?.trim()
    ? normalizeProviderHttpMethod(binding.pollMethod, 'GET')
    : binding.pollMethod
    ? normalizeProviderHttpMethod(binding.pollMethod, 'GET')
    : undefined;

  if (
    binding.submitMethod === submitMethod &&
    binding.pollMethod === pollMethod
  ) {
    return binding;
  }

  return {
    ...binding,
    submitMethod,
    ...(pollMethod ? { pollMethod } : {}),
  };
}
