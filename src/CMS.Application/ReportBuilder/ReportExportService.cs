using OfficeOpenXml;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CMS.Application.ReportBuilder;

public class ReportExportService
{
    static ReportExportService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
    }

    public byte[] ExportToPdf(string title, List<string> headers, List<Dictionary<string, object>> rows)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(30);
                page.Size(PageSizes.A4);
                page.Header().Text(title).FontSize(20).Bold().FontColor(Colors.Blue.Darken2);
                page.Content().PaddingVertical(10).Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        foreach (var _ in headers) columns.RelativeColumn();
                    });

                    table.Header(header =>
                    {
                        foreach (var h in headers)
                        {
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(5).Text(h).Bold();
                        }
                    });

                    foreach (var row in rows)
                    {
                        foreach (var h in headers)
                        {
                            var val = row.TryGetValue(h, out var v) ? v?.ToString() ?? "" : "";
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(5).Text(val);
                        }
                    }
                });
                page.Footer().AlignCenter().Text(x => x.CurrentPageNumber());
            });
        });

        return document.GeneratePdf();
    }

    public byte[] ExportToExcel(string title, List<string> headers, List<Dictionary<string, object>> rows)
    {
        using var package = new ExcelPackage();
        var worksheet = package.Workbook.Worksheets.Add(title);

        for (int i = 0; i < headers.Count; i++)
        {
            worksheet.Cells[1, i + 1].Value = headers[i];
            worksheet.Cells[1, i + 1].Style.Font.Bold = true;
            worksheet.Cells[1, i + 1].Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
            worksheet.Cells[1, i + 1].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.LightGray);
        }

        for (int r = 0; r < rows.Count; r++)
        {
            for (int c = 0; c < headers.Count; c++)
            {
                var val = rows[r].TryGetValue(headers[c], out var v) ? v : null;
                worksheet.Cells[r + 2, c + 1].Value = val;
            }
        }

        worksheet.Cells.AutoFitColumns();
        return package.GetAsByteArray();
    }
}
