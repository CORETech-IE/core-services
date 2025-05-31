import path from "path";
import { promises as fs } from "fs";
import { compileFile } from "pug";
import { config } from "../../config/config";
import { acquirePage, releasePage } from "../../config/browserPool";
import { sendLog } from "../../services/logEmitter";
import { v4 as uuidv4 } from "uuid";

interface CoreReportInfo {
  report_name: string;
  report_description: string;
  report_template: string;
  report_version: string;
  report_file_name: string;
  report_out_mode: string;
}

export async function generatePDF(data: any): Promise<Buffer> {
  const info: CoreReportInfo = data.core_report_info;
  const trace_id = uuidv4(); // Generate a unique trace ID for this request

  if (!info || !info.report_template) {
    throw new Error("Missing core_report_info or report_template");
  }

  const templatePath = path.join(
    config.pdf.templatePath,
    `${info.report_template}.pug`
  );
  const cssPath = path.join(config.pdf.cssPath, `${info.report_template}.css`);

  const cssContent = await fs.readFile(cssPath, "utf-8");
  const compile = compileFile(templatePath);
  const html = compile({
    ...data,
    embeddedCSS: `<style>${cssContent}</style>`,
  });

  const page = await acquirePage();

  try {
    await page.setContent(html, { waitUntil: "domcontentloaded" }); // más rápido que 'networkidle0'

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    console.log(
      `[core-services] PDF generated successfully: ${info.report_file_name}`
    );
    await sendLog({
      service: "pdf",
      level: "INFO",
      message: "PDF generated successfully",
      trace_id,
    });

    return pdfBuffer;
  } catch (error) {
    await sendLog({
      service: "pdf",
      level: "ERROR",
      message: `Failed to generate PDF: ${(error as Error).message}`,
      trace_id,
    });

    throw error;
  } finally {
    releasePage(page);
  }
}
