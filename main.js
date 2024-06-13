require('dotenv').config()
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
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

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('qr', qr => {
    // Genera el QR y guárdalo como una imagen
    qrcode.toFile(path.join(__dirname, 'qr.png'), qr, (err) => {
        if (err) {
            console.error('Error generating QR code', err);
        } else {
            console.log('QR code saved as qr.png');
        }
    });
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
        res.status(200).send(response);
    }).catch(error => {
        res.status(500).send(error);
    });
});

app.post('/send-media', authenticateToken, (req, res) => {
    const { from, text, path } = req.body;    
    const media = MessageMedia.fromFilePath(path);

    if(text !== '') {
        client.sendMessage(from, media, { caption: text}).then(response => {
            res.status(200).send(response);
        }).catch(error => {
            res.status(500).send(error);
        });
    }else{
        client.sendMessage(from, media).then(response => {
            res.status(200).send(response);
        }).catch(error => {
            res.status(500).send
        });
    }
    
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
