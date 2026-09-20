import { PDFDocument } from 'pdfkit';

const COLORS = Object.freeze({
    navy: '#111827',
    blue: '#2563EB',
    gold: '#D69E2E',
    ink: '#172033',
    muted: '#5B6475',
    line: '#D9DEE8',
    soft: '#F4F6FA',
    white: '#FFFFFF'
});

function formatMoney(value) {
    const [whole, fraction = '00'] = String(value).split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `CRC ${grouped},${fraction.padEnd(2, '0').slice(0, 2)}`;
}

function formatAcceptedAt(value) {
    return new Intl.DateTimeFormat('es-CR', {
        dateStyle: 'long',
        timeStyle: 'medium',
        timeZone: 'America/Costa_Rica'
    }).format(new Date(value));
}

function formatDrawDate(value) {
    const [year, month, day] = String(value).split('-');
    return `${day}/${month}/${year}`;
}

function writeCell(doc, text, x, y, width, options = {}) {
    doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(options.size || 7.5)
        .fillColor(options.color || COLORS.ink)
        .text(String(text), x, y, {
            width,
            height: options.height || 22,
            ellipsis: true,
            align: options.align || 'left',
            lineBreak: false
        });
}

function drawTableHeader(doc, y) {
    const columns = [
        ['Sorteo', 70], ['Fecha y hora', 110], ['Modalidad', 100],
        ['Número', 48], ['Monto', 100], ['Mult.', 100]
    ];
    let x = 42;
    doc.roundedRect(42, y, 528, 25, 4).fill(COLORS.navy);
    for (const [label, width] of columns) {
        writeCell(doc, label, x + 5, y + 8, width - 10, { bold: true, color: COLORS.white, size: 7 });
        x += width;
    }
    return y + 25;
}

function addPageHeading(doc, receipt, continuation = false) {
    doc.rect(0, 0, 612, 84).fill(COLORS.navy);
    doc.font('Helvetica-Bold').fontSize(19).fillColor(COLORS.white).text(receipt.issuer.displayName, 42, 27);
    doc.font('Helvetica').fontSize(9).fillColor('#CAD2E2').text(
        continuation ? 'Comprobante de apuesta - continuación' : 'Comprobante de apuesta',
        42,
        54
    );
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.gold)
        .text(receipt.ticketCode, 390, 31, { width: 180, align: 'right' });
}

function addPageNumbers(doc) {
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index++) {
        doc.switchToPage(index);
        const bottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted)
            .text(`Página ${index + 1} de ${range.count}`, 42, 756, {
                width: 528,
                align: 'right',
                lineBreak: false
            });
        doc.page.margins.bottom = bottomMargin;
    }
}

export function renderBetReceiptPdf(receipt) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'LETTER', margin: 42, bufferPages: true, info: {
            Title: `Comprobante ${receipt.ticketCode}`,
            Author: receipt.issuer.displayName,
            Subject: 'Comprobante de apuesta aceptada',
            CreationDate: new Date(receipt.acceptedAt)
        } });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        addPageHeading(doc, receipt);
        doc.roundedRect(42, 104, 528, 94, 8).fill(COLORS.soft);
        doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text('Cliente', 56, 119);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink)
            .text(receipt.customer.fullName, 56, 133, { width: 245, ellipsis: true });
        doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text('Fecha de aceptación', 316, 119);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink)
            .text(formatAcceptedAt(receipt.acceptedAt), 316, 133, { width: 238 });
        doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text('Código del ticket', 56, 162);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.blue).text(receipt.ticketCode, 56, 175);
        doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text('Zona horaria', 316, 162);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink).text('Costa Rica', 316, 175);

        let y = 221;
        doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.ink).text('Jugadas aceptadas', 42, y);
        y = drawTableHeader(doc, y + 20);

        receipt.items.forEach((item, index) => {
            if (y + 27 > 742) {
                doc.addPage();
                addPageHeading(doc, receipt, true);
                y = drawTableHeader(doc, 106);
            }
            if (index % 2 === 0) doc.rect(42, y, 528, 25).fill(COLORS.soft);
            const values = [
                [item.lottery, 70],
                [`${formatDrawDate(item.drawDate)} ${item.scheduleTime}`, 110],
                [item.modality.replaceAll('_', ' '), 100],
                [item.numberPlayed, 48],
                [formatMoney(item.amount), 100],
                [`x${item.multiplier}`, 100]
            ];
            let x = 42;
            for (const [value, width] of values) {
                writeCell(doc, value, x + 5, y + 8, width - 10, {
                    bold: x === 322 || x === 470,
                    align: x >= 370 ? 'right' : 'left',
                    size: x === 222 ? 6.8 : 7.5
                });
                x += width;
            }
            doc.moveTo(42, y + 25).lineTo(570, y + 25).strokeColor(COLORS.line).lineWidth(0.4).stroke();
            y += 25;
        });

        if (y + 112 > 742) {
            doc.addPage();
            addPageHeading(doc, receipt, true);
            y = 112;
        } else {
            y += 18;
        }
        doc.roundedRect(340, y, 230, 48, 7).fill(COLORS.navy);
        doc.font('Helvetica').fontSize(8).fillColor('#CAD2E2').text('TOTAL APOSTADO', 354, y + 10);
        doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.white)
            .text(formatMoney(receipt.totalAmount), 354, y + 23, { width: 202, align: 'right' });
        y += 66;
        doc.roundedRect(42, y, 528, 44, 6).fill('#FFF8E5');
        doc.font('Helvetica').fontSize(8.5).fillColor('#6A5311').text(
            'Este comprobante acredita una apuesta aceptada. La apuesta no puede editarse ni cancelarse por solicitud del jugador.',
            56,
            y + 12,
            { width: 500, lineGap: 2 }
        );
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text(
            `Importes en ${receipt.currency}. Horarios oficiales de Costa Rica.`,
            42,
            y + 57
        );

        addPageNumbers(doc);
        doc.end();
    });
}
