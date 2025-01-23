import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Row, MaterialProperties } from "../types";

const DataTransformer: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (!e.target?.result) return;

      const workbook = XLSX.read(e.target.result, {
        type: "binary",
        cellStyles: true,
        cellFormula: true,
        cellDates: true,
        cellNF: true,
        sheetStubs: true,
      });

      const allRows: Row[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

        let startRow = 0;
        for (let i = 0; i < data.length; i++) {
          if (
            data[i] &&
            data[i].some((cell: any) => cell === "Date" || cell === "Size")
          ) {
            startRow = i + 1;
            break;
          }
        }

        for (let i = startRow; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length < 10) continue;

          const getAvgHardness = (hardnessStr: any): number | null => {
            if (!hardnessStr || hardnessStr.toString().trim() === "")
              return null;

            const str = hardnessStr.toString().trim();

            // Case 1: Formatted values like "09 043.3"
            const formattedMatch = str.match(/\d+\s+(\d+\.?\d*)/g);
            if (formattedMatch) {
              const values = formattedMatch
                .map((s: string) => {
                  const match = s.match(/\d+\s+(\d+\.?\d*)/);
                  return match ? parseFloat(match[1]) : null;
                })
                .filter((n: number | null): n is number => n !== null);

              if (values.length > 0) {
                return Number(
                  (
                    values.reduce((a: number, b: number) => a + b) /
                    values.length
                  ).toFixed(1)
                );
              }
            }

            // Case 2: Period-separated values (e.g. "47.47.46")
            if (str.includes(".")) {
              const values = str
                .split(".")
                .map((s: string) => parseInt(s))
                .filter((n: number) => !isNaN(n));

              if (values.length > 0) {
                return Number(
                  (
                    values.reduce((a: number, b: number) => a + b) /
                    values.length
                  ).toFixed(1)
                );
              }
            }

            // Case 3: Space-separated degree values
            if (str.includes("°")) {
              const values = str
                .split(/\s+/)
                .map((s: string) => {
                  const match = s.match(/(\d+)°/);
                  return match ? parseFloat(match[1]) : null;
                })
                .filter((n: number | null): n is number => n !== null);

              if (values.length > 0) {
                return Number(
                  (
                    values.reduce((a: number, b: number) => a + b) /
                    values.length
                  ).toFixed(1)
                );
              }
            }

            // Case 3: Single number
            if (/^\d+\.?\d*$/.test(str)) {
              return Number(parseFloat(str).toFixed(1));
            }

            return null;
          };

          const size = row[1]
            ? parseInt(row[1].toString().replace("L#", "").replace("R#", ""))
            : null;
          if (!size) continue;

          const csaHardness = getAvgHardness(row[3]);
          const enHardness = getAvgHardness(row[11]);

          const materialProps: MaterialProperties = {
            yieldStr: 434,
            tensileStr: 739,
            elongation: 25.5,
            elasticMod: 210,
          };

          const createRow = (
            hardness: number | null,
            thickness: number | null,
            originalHeight: number | null,
            size: number,
            temp: number,
            testType: number,
            plasticineHeight: number | null
          ): Row => ({
            hardness,
            yieldStr: materialProps.yieldStr,
            tensileStr: materialProps.tensileStr,
            elongation: materialProps.elongation,
            elasticMod: materialProps.elasticMod,
            thickness,
            height: originalHeight,
            size,
            temperature: temp,
            testType,
            plasticineHeight,
          });

          // CSA data with fallback for missing Original Hgt.
          if (row[2] && row[4] && row[5]) {
            const originalHeight = row[6]
              ? Number(row[6])
              : Number(row[4]) || null;
            allRows.push(
              createRow(
                csaHardness,
                Number(row[2]) || null,
                originalHeight,
                size,
                0,
                0,
                Number(row[5]) || null
              )
            );
          }

          // EN data
          if (row[10] && row[12] && row[13]) {
            allRows.push(
              createRow(
                enHardness,
                Number(row[10]) || null,
                Number(row[12]) || null,
                size,
                0,
                1,
                Number(row[13]) || null
              )
            );
          }
        }
      }

      setRows(allRows);
    };
    reader.readAsBinaryString(file);
  };

  const handleExport = () => {
    const header = [
      "Hardness (HRC)",
      "Yield Str (MPa)",
      "Tensile Str (MPa)",
      "Elongation(%)",
      "Elastic Mod (GPa)",
      "Thickness (mm)",
      "Height (mm)",
      "Size",
      "Temperature",
      "Test Type",
      "Plasticine Height (mm)",
    ];

    const ws = XLSX.utils.aoa_to_sheet([
      header,
      ...rows.map((row) => [
        row.hardness,
        row.yieldStr,
        row.tensileStr,
        row.elongation,
        row.elasticMod,
        row.thickness,
        row.height,
        row.size,
        row.temperature,
        row.testType,
        row.plasticineHeight,
      ]),
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "All Data");
    XLSX.writeFile(wb, "transformed_all_data.xlsx");
  };

  return (
    <div className="p-4">
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
        className="mb-4 block"
      />
      <button
        onClick={handleExport}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        disabled={rows.length === 0}
      >
        Export All Data to Excel
      </button>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">Hardness (HRC)</th>
              <th className="border p-2">Yield Str (MPa)</th>
              <th className="border p-2">Tensile Str (MPa)</th>
              <th className="border p-2">Elongation(%)</th>
              <th className="border p-2">Elastic Mod (GPa)</th>
              <th className="border p-2">Thickness (mm)</th>
              <th className="border p-2">Height (mm)</th>
              <th className="border p-2">Size</th>
              <th className="border p-2">Temperature</th>
              <th className="border p-2">Test Type</th>
              <th className="border p-2">Plasticine Height (mm)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="border p-2">{row.hardness}</td>
                <td className="border p-2">{row.yieldStr}</td>
                <td className="border p-2">{row.tensileStr}</td>
                <td className="border p-2">{row.elongation}</td>
                <td className="border p-2">{row.elasticMod}</td>
                <td className="border p-2">{row.thickness}</td>
                <td className="border p-2">{row.height}</td>
                <td className="border p-2">{row.size}</td>
                <td className="border p-2">{row.temperature}</td>
                <td className="border p-2">{row.testType}</td>
                <td className="border p-2">{row.plasticineHeight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTransformer;
