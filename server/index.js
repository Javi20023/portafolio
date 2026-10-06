const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const path = require('path');

const AUTH_DIR = path.join(__dirname, 'auth');
const WORKSHOP_NAME = 'Taller EbenEzer';

let sock = null;

async function startWhatsApp() {
  console.log(`\n${WORKSHOP_NAME} - WhatsApp Service`);
  console.log('='.repeat(40));

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.windows(` ${WORKSHOP_NAME} `),
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log('\nEscanea este QR con WhatsApp del taller:\n');
      qrcode.generate(qr, { small: true });
      console.log('\nAbre WhatsApp > Dispositivos vinculados > Vincular dispositivo\n');
    }

    if (connection === 'open') {
      console.log('\n[OK] WhatsApp conectado exitosamente!');
      console.log('[OK] Servicio listo para enviar mensajes.\n');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`\n[WARN] Conexion cerrada (codigo: ${statusCode})`);

      if (shouldReconnect) {
        console.log('[INFO] Reconectando en 3 segundos...');
        setTimeout(startWhatsApp, 3000);
      } else {
        console.log('[ERROR] Sesion cerrada. Elimina la carpeta "auth/" y reinicia para generar un nuevo QR.');
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      const from = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (text) {
        console.log(`[MSG] ${from}: ${text}`);
      }
    }
  });
}

async function sendMessage(phoneNumber, text) {
  if (!sock) throw new Error('WhatsApp no esta conectado');

  const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;

  const result = await sock.sendMessage(jid, { text });
  console.log(`[ENV] -> ${phoneNumber}: ${text.substring(0, 50)}...`);
  return result;
}

async function sendAppointmentReminder(phoneNumber, clientName, date, time) {
  const text = `Hola ${clientName}, le recordamos su cita programada para el ${date} a las ${time}. Confirma respondiendo SÍ o NO.`;
  return sendMessage(phoneNumber, text);
}

process.on('SIGINT', () => {
  console.log('\n[INFO] Cerrando servicio WhatsApp...');
  process.exit(0);
});

startWhatsApp().catch((err) => {
  console.error('[ERROR] Fallo al iniciar WhatsApp:', err.message);
  process.exit(1);
});

module.exports = { sendMessage, sendAppointmentReminder };
