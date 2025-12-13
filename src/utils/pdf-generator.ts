import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Types ---
export interface PdfReportData {
  period: string;
  startDate: string;
  endDate: string;
  totalIn: number;
  totalOut: number;
  netBalance: number;
  avgBalance: number;
  days: Array<{
    date: string;
    summary: string;
    records: Array<string[]>
  }>;
}

// --- Helpers ---

/**
 * 加载本地字体文件并转换为 Base64
 * [优化] 使用 uni.arrayBufferToBase64 原生方法，避免大循环导致内存溢出
 */
const loadCustomFont = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 字体路径：建议放在 static 根目录下，打包时会自动复制
    // 注意：如果是 App 端真机运行，可能需要使用 plus.io API，但通常 static 目录 HTTP 请求方式兼容性最好
    const fontUrl = '/static/fonts/SimHei.ttf'; 

    uni.request({
      url: fontUrl,
      method: 'GET',
      responseType: 'arraybuffer',
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          try {
            // ✅ [性能关键点] 使用原生 API 瞬间完成转换，不占 JS 堆内存
            // @ts-ignore (uni-app 类型定义有时可能滞后，但此 API 存在)
            const base64 = uni.arrayBufferToBase64(res.data as ArrayBuffer);
            resolve(base64);
          } catch (e) {
            console.error('Font conversion failed:', e);
            reject('Font conversion failed');
          }
        } else {
          console.error('Font file not found or download failed:', fontUrl);
          reject(`Font file not found: ${fontUrl}`);
        }
      },
      fail: (err) => {
        console.error('Font request failed:', err);
        reject(err);
      }
    });
  });
};

/**
 * 生成矢量 PDF (修复中英文混排问题)
 */
export const generatePDF = async (data: PdfReportData, fileName: string): Promise<void> => {
  // 1. 初始化文档
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  
  try {
    // 2. 加载字体 (异步)
    const fontBase64 = await loadCustomFont();
    
    const fontFileName = 'SimHei.ttf';
    const fontName = 'SimHei';
    
    // [关键配置 1] 将字体文件添加到虚拟文件系统 (VFS)
    doc.addFileToVFS(fontFileName, fontBase64);
    
    // [关键配置 2] 注册字体，指定编码为 'Identity-H' 以支持 Unicode (中文)
    doc.addFont(fontFileName, fontName, 'normal', 'Identity-H');
    
    // [关键配置 3] 注册同一个字体为 'bold'，防止 autoTable 用粗体时找不到字体而乱码
    doc.addFont(fontFileName, fontName, 'bold', 'Identity-H');

    // 全局设置字体
    doc.setFont(fontName); 

    let currentY = 20;

    // --- Header Section ---
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text("Stone Record 液体平衡报告", pageWidth / 2, currentY, { align: 'center' });
    
    currentY += 10;
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Range / 周期: ${data.startDate} - ${data.endDate} (${data.period})`, pageWidth / 2, currentY, { align: 'center' });

    // --- Summary Table ---
    currentY += 10;
    
    autoTable(doc, {
      startY: currentY,
      // 表头包含中文和英文
      head: [['Total In (总入)', 'Total Out (总出)', 'Balance (净平衡)', 'Avg (日均)']],
      body: [[
        `+${data.totalIn} mL`, 
        `-${data.totalOut} mL`, 
        `${data.netBalance > 0 ? '+' : ''}${data.netBalance} mL`,
        `${data.avgBalance} mL/day`
      ]],
      theme: 'grid',
      styles: { 
        font: fontName, // 必须指定字体
        fontStyle: 'normal', 
        fontSize: 11, 
        halign: 'center', 
        cellPadding: 4,
        textColor: 20
      },
      headStyles: { 
        font: fontName, 
        fontStyle: 'bold', 
        fillColor: [240, 240, 240], 
        textColor: 0, 
        lineWidth: 0.1,
        lineColor: 0
      },
    });

    // --- Daily Details Loop ---
    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 15;

    data.days.forEach((day) => {
      // Check Page Break
      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
      }

      // 1. Day Header
      doc.setFontSize(12);
      doc.setFont(fontName, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(day.date, 14, currentY);
      
      doc.setFontSize(10);
      doc.setFont(fontName, 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(day.summary, pageWidth - 14, currentY, { align: 'right' });

      currentY += 3;

      // 2. Details Table
      autoTable(doc, {
        startY: currentY,
        head: [['Time', 'Type', 'Item (项目)', 'Amount (mL)', 'Note (备注)']],
        body: day.records,
        theme: 'plain', 
        styles: { 
          font: fontName, // 再次确保指定字体
          fontSize: 10, 
          cellPadding: 2, 
          lineColor: [200, 200, 200], 
          lineWidth: 0.1,
          textColor: 50
        },
        headStyles: { 
          font: fontName, 
          fontStyle: 'bold', 
          textColor: 0, 
          borderBottomWidth: 0.5, 
          borderColor: 0 
        },
        columnStyles: {
          0: { width: 25 }, 
          1: { width: 20, fontStyle: 'bold' }, 
          2: { width: 40 }, 
          3: { width: 30, halign: 'right' }, 
          4: { fontStyle: 'italic', textColor: 100 } 
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            const text = data.cell.raw as string;
            // 兼容中文判断
            if (text === 'IN' || text === '入量') data.cell.styles.textColor = [0, 150, 0]; 
            if (text === 'OUT' || text === '出量') data.cell.styles.textColor = [200, 50, 50]; 
          }
        }
      });

      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 10;
    });

    // --- Footer (Page Numbers) ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont(fontName, 'normal'); 
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, 290, { align: 'center' });
    }

    // 4. Save
    doc.save(`${fileName}.pdf`);

  } catch (error) {
    console.error('PDF Generation Error:', error);
    // 这里抛出错误，以便 UI 层捕获并停止 loading 动画
    throw error;
  }
};