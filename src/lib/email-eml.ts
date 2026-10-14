/*
 * File:      email-eml.ts
 * Percorso:  src/lib/email-eml.ts
 * Data:      14/10/2026
 * Modifica:  02
 *
 * Modifica 02:
 *  - costruisciEml() accetta anche corpoHtml: l'email contiene il testo semplice E una versione HTML
 *    (multipart/alternative). Con l'HTML l'operatore può usare grassetto e formattazione nel programma
 *    di posta; con il solo testo semplice la formattazione non è possibile.
 *
 * Utilità per la Postazione Operatore:
 *  - costruisciEml(): crea una bozza email (.eml) con testo e allegati già inclusi.
 *    Aprendo il file, Outlook desktop / Thunderbird / Apple Mail mostrano la bozza
 *    pronta da inviare, con i file allegati (il link mailto: non può allegare file).
 *  - salvaFileConNome(): apre la finestra "Salva con nome" del browser con il nome
 *    già rinominato, così l'operatore sceglie ogni volta la cartella di destinazione.
 *  - scaricaBlob(): download classico di un file con un nome scelto.
 */

const CRLF = "\r\n";

export type AllegatoEml = { nome: string; mime: string; blob: Blob };

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const BLOCCO = 0x8000;
  for (let i = 0; i < bytes.length; i += BLOCCO) {
    bin += String.fromCharCode(...bytes.subarray(i, i + BLOCCO));
  }
  return btoa(bin);
}

/** Base64 spezzato in righe da 76 caratteri, come richiesto dal formato email. */
function base64Righe(bytes: Uint8Array): string {
  return (bytesToBase64(bytes).match(/.{1,76}/g) ?? []).join(CRLF);
}

/** Intestazione con caratteri non ASCII (es. "—" o lettere accentate) in forma sicura. */
function intestazioneUtf8(testo: string): string {
  const caratteri = Array.from(testo);
  const pezzi: string[] = [];
  for (let i = 0; i < caratteri.length; i += 24) {
    const parte = new TextEncoder().encode(caratteri.slice(i, i + 24).join(""));
    pezzi.push(`=?UTF-8?B?${bytesToBase64(parte)}?=`);
  }
  return pezzi.join(`${CRLF} `);
}

/** Nome file sicuro dentro le intestazioni (niente virgolette o a capo). */
const nomeSicuro = (n: string) => n.replace(/["\r\n\\]/g, "_");

/**
 * Costruisce una bozza email (.eml) con corpo testuale e allegati.
 * L'intestazione "X-Unsent: 1" fa aprire il file come bozza da inviare (Outlook).
 */
export async function costruisciEml(opzioni: {
  a: string[];
  oggetto: string;
  corpo: string;
  /** Versione formattata del corpo (HTML). Se assente l'email ha solo il testo semplice. */
  corpoHtml?: string;
  allegati: AllegatoEml[];
}): Promise<Blob> {
  const confine = `----=_Attestati_${crypto.randomUUID()}`;
  const enc = new TextEncoder();
  const righe: string[] = [];

  righe.push("X-Unsent: 1");
  if (opzioni.a.length) righe.push(`To: ${opzioni.a.join(", ")}`);
  righe.push(`Subject: ${intestazioneUtf8(opzioni.oggetto)}`);
  righe.push("MIME-Version: 1.0");
  righe.push(`Content-Type: multipart/mixed; boundary="${confine}"`);
  righe.push("");

  const testoSemplice = base64Righe(enc.encode(opzioni.corpo.replace(/\r?\n/g, CRLF)));
  if (opzioni.corpoHtml) {
    const confineAlt = `----=_Alt_${crypto.randomUUID()}`;
    righe.push(`--${confine}`);
    righe.push(`Content-Type: multipart/alternative; boundary="${confineAlt}"`);
    righe.push("");
    righe.push(`--${confineAlt}`);
    righe.push("Content-Type: text/plain; charset=UTF-8");
    righe.push("Content-Transfer-Encoding: base64");
    righe.push("");
    righe.push(testoSemplice);
    righe.push("");
    righe.push(`--${confineAlt}`);
    righe.push("Content-Type: text/html; charset=UTF-8");
    righe.push("Content-Transfer-Encoding: base64");
    righe.push("");
    righe.push(base64Righe(enc.encode(opzioni.corpoHtml.replace(/\r?\n/g, CRLF))));
    righe.push("");
    righe.push(`--${confineAlt}--`);
    righe.push("");
  } else {
    righe.push(`--${confine}`);
    righe.push("Content-Type: text/plain; charset=UTF-8");
    righe.push("Content-Transfer-Encoding: base64");
    righe.push("");
    righe.push(testoSemplice);
    righe.push("");
  }

  for (const al of opzioni.allegati) {
    const nome = nomeSicuro(al.nome);
    righe.push(`--${confine}`);
    righe.push(`Content-Type: ${al.mime}; name="${nome}"`);
    righe.push("Content-Transfer-Encoding: base64");
    righe.push(`Content-Disposition: attachment; filename="${nome}"`);
    righe.push("");
    righe.push(base64Righe(new Uint8Array(await al.blob.arrayBuffer())));
    righe.push("");
  }

  righe.push(`--${confine}--`);
  righe.push("");

  return new Blob([righe.join(CRLF)], { type: "message/rfc822" });
}

/** Scarica un file con il nome indicato (cartella Download del browser). */
export function scaricaBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

type SaveHandle = {
  createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }>;
};

export type EsitoSalvataggio = "salvato" | "scaricato" | "annullato";

/**
 * Apre la finestra "Salva con nome" (Chrome/Edge da computer) con il nome già
 * rinominato: l'operatore sceglie la cartella a ogni salvataggio. Il browser
 * ricorda l'ultima cartella usata e la propone come punto di partenza.
 * Dove la finestra non è disponibile (Firefox, Safari, anteprima in iframe)
 * il file viene scaricato normalmente con il nome corretto.
 *
 * Il file viene letto DOPO la scelta della cartella, così la finestra si apre
 * subito dopo il clic (il browser la consente solo in risposta a un clic).
 */
export async function salvaFileConNome(
  ottieniBlob: () => Promise<Blob>,
  nome: string,
  mime: string,
): Promise<EsitoSalvataggio> {
  const w = window as unknown as {
    showSaveFilePicker?: (o?: unknown) => Promise<SaveHandle>;
  };

  let handle: SaveHandle | null = null;
  if (w.showSaveFilePicker) {
    const estensione = nome.includes(".") ? `.${nome.split(".").pop()}` : "";
    try {
      handle = await w.showSaveFilePicker({
        id: "attestati-operatore",
        suggestedName: nome,
        startIn: "documents",
        types: estensione ? [{ description: "Attestato", accept: { [mime]: [estensione] } }] : undefined,
      });
    } catch (e) {
      const n = (e as Error).name;
      if (n === "AbortError") return "annullato";
      if (n !== "SecurityError") throw e;
      // SecurityError: pagina dentro un iframe (anteprima Lovable) -> download classico
    }
  }

  const blob = await ottieniBlob();
  if (handle) {
    const scrittura = await handle.createWritable();
    await scrittura.write(blob);
    await scrittura.close();
    return "salvato";
  }
  scaricaBlob(blob, nome);
  return "scaricato";
}
