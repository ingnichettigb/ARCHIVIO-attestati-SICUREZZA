/*
 * File:      ruota-documento.ts
 * Percorso:  src/lib/ruota-documento.ts
 * Data:      14/10/2026
 * Modifica:  01
 *
 * Ruota un documento (PDF o foto) per migliorarne la lettura nell'anteprima
 * della Postazione Operatore. Parte sempre dal documento originale e applica
 * l'angolo totale richiesto (0, 90, 180, 270): ruotare più volte non degrada
 * la qualità delle foto.
 */
import { PDFDocument, degrees } from "pdf-lib";

/** Ruota di `gradi` (multiplo di 90, in senso orario) e restituisce un nuovo Blob. */
export async function ruotaDocumento(originale: Blob, mime: string, gradi: number): Promise<Blob> {
  const angolo = ((Math.round(gradi / 90) * 90) % 360 + 360) % 360;
  if (angolo === 0) return originale;
  return mime === "application/pdf" ? ruotaPdf(originale, angolo) : ruotaImmagine(originale, mime, angolo);
}

async function ruotaPdf(originale: Blob, angolo: number): Promise<Blob> {
  const doc = await PDFDocument.load(await originale.arrayBuffer(), { ignoreEncryption: true });
  for (const pagina of doc.getPages()) {
    pagina.setRotation(degrees((pagina.getRotation().angle + angolo) % 360));
  }
  const bytes = await doc.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

async function ruotaImmagine(originale: Blob, mime: string, angolo: number): Promise<Blob> {
  const bmp = await createImageBitmap(originale);
  const laterale = angolo % 180 !== 0;
  const canvas = document.createElement("canvas");
  canvas.width = laterale ? bmp.height : bmp.width;
  canvas.height = laterale ? bmp.width : bmp.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Rotazione non disponibile su questo browser");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((angolo * Math.PI) / 180);
  ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  bmp.close();
  const tipoUscita = mime === "image/png" ? "image/png" : "image/jpeg";
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Rotazione non riuscita"))), tipoUscita, 0.92),
  );
}
