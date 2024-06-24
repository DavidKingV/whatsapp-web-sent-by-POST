require('dotenv').config()
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const qrcodeterminal = require('qrcode-terminal');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const SECRET_KEY = process.env.SECRET_KEY;

let isAuthenticated = false; // Variable para verificar si está autenticado
let qrCodeData = ''; 

const client = new Client({
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2410.1.html',
    },
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        timeout: 30000
    }

});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('authenticated', () => {
    isAuthenticated = true;
    console.log('Client is authenticated');
});

client.on('auth_failure', () => {
    isAuthenticated = false;
    console.log('Authentication failed');
});

client.on('qr', qr => {
    qrCodeData = qr;
    isAuthenticated = false; // Asegurarse de que no esté autenticado
    qrcodeterminal.generate(qr, {small: true});
    console.log('QR code received');
});

client.initialize();

/*client.on('message_create', message => {
    if (message.body === '!ping') {
        console.log('Received ping! from', message.from);
        // send back "pong" to the chat the message was sent in
        client.sendMessage(message.from, 'pong');
    }
});*/

// Middleware para verificar el token JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) return res.sendStatus(401); // Si no hay token, deniega la solicitud

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Ruta para recibir las solicitudes y enviar mensajes
app.post('/send-message', authenticateToken, (req, res) => {
    const { from, text } = req.body;

    client.sendMessage(from, text).then(response => {
        console.log(response);        
        res.status(200).send(response);
    }).catch(error => {
        res.status(500).send(error);
    });
});

app.post('/send-media', authenticateToken, async (req, res) => {
    try {
        const { from, text, file } = req.body;    
        const media = await MessageMedia.fromUrl(file);

        if (text !== '') {
            await client.sendMessage(from, media, { caption: text }).then(response => {
                res.status(200).send(response);
            }).catch(error => {
                res.status(500).send(error);
            });
        } else {
            console.log(media);
            await client.sendMessage(from, media).then(response => {
                res.status(200).send(response);
            }).catch(error => {
                res.status(500).send(error);
            });
        }
    } catch (error) {
        res.status(500).send(error);
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para servir el código QR
app.get('/qr-status', (req, res) => {
    if (isAuthenticated) {
        res.json({ authenticated: true });
    } else {
        qrcode.toBuffer(qrCodeData, (err, buffer) => {
            if (err) {
                res.status(500).send('Error generating QR code');
            } else {
                res.json({ authenticated: false, qrCode: buffer.toString('base64') });
            }
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
