import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

describe('spreadsheet dependency compatibility', () => {
  it('round-trips the batch image import/export fields', () => {
    const rows = [
      {
        提示词: '雨夜里的霓虹城市',
        模型: 'gpt-image-2',
        尺寸: '1:1',
        数量: 2,
      },
      {
        提示词: '纸雕风格的山谷',
        模型: 'gemini-image',
        尺寸: '16:9',
        数量: 1,
      },
    ];
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [{ wch: 32 }, { wch: 20 }, { wch: 10 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(workbook, worksheet, '批量出图模板');

    const bytes = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });
    const restoredWorkbook = XLSX.read(bytes, { type: 'array' });
    const restoredRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      restoredWorkbook.Sheets[restoredWorkbook.SheetNames[0]]
    );

    expect(restoredWorkbook.SheetNames).toEqual(['批量出图模板']);
    expect(restoredRows).toEqual(rows);
  });

  it('preserves benchmark sheet order and structured values', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        { 模型: 'profile-a/model-a', 成功数: 3, 平均耗时: 1250 },
      ]),
      '模型汇总'
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          序号: 1,
          状态: '成功',
          结果地址: 'https://example.test/artifact.png',
        },
      ]),
      '原始结果'
    );

    const bytes = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });
    const restoredWorkbook = XLSX.read(bytes, { type: 'array' });

    expect(restoredWorkbook.SheetNames).toEqual(['模型汇总', '原始结果']);
    expect(
      XLSX.utils.sheet_to_json(restoredWorkbook.Sheets['模型汇总'])
    ).toEqual([{ 模型: 'profile-a/model-a', 成功数: 3, 平均耗时: 1250 }]);
    expect(
      XLSX.utils.sheet_to_json(restoredWorkbook.Sheets['原始结果'])
    ).toEqual([
      {
        序号: 1,
        状态: '成功',
        结果地址: 'https://example.test/artifact.png',
      },
    ]);
  });
});
