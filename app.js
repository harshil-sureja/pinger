const nodemailer = require('nodemailer');
const fs = require('fs');
const https = require('https');

// Config
const config = {
  pingUrls: [
    // {
    //   tag: 'Fling Front',
    //   type: 'UAT',
    //   domain: 'https://flingfront.alliancetek.net',
    //   failureEmailTo: ['madumotin@getnada.com'],
    // },
    {
      tag: 'Fling API',
      type: 'UAT',
      domain: 'https://flingappuat.alliancetek.net1',
      failureEmailTo: ['madumotin@getnada.com'],
    },
    // {
    //   tag: 'Fling Front',
    //   type: 'STAGE',
    //   domain: 'https://flingfrontstage.alliancetek.net',
    //   failureEmailTo: ['madumotin@getnada.com'],
    // },
    // {
    //   tag: 'Fling API',
    //   type: 'STAGE',
    //   domain: 'https://flingappstage.alliancetek.net',
    //   failureEmailTo: ['madumotin@getnada.com'],
    // },
  ],
  pingInterval: 1000 * 60,
  logFilePath: `./logs/${new Date().toISOString().split('T')[0]}_pinger.log`,
  SMTP: {
    host: 'smtp.office365.com',
    port: 587,
    secure: true,
    auth: {
      user: 'projectsat@alliancetek.com',
      pass: 'Pr0j3st#456',
    },
    service: 'Outlook365',
  },
};

let mailSend = [];

// Transporter configuration for NodeMailer
const transporter = nodemailer.createTransport({
  host: config.SMTP.host,
  port: config.SMTP.port,
  secure: config.SMTP.secure,
  auth: {
    user: config.SMTP.auth.user,
    pass: config.SMTP.auth.pass,
  },
  service: config.SMTP.service,
});

// Function to send an email using NodeMailer
const sendEmail = async ({ subject, text, to }) => {
  try {
    const info = await transporter.sendMail({
      subject,
      text,
      from: config.SMTP.auth.user,
      to,
    });
    console.log('Email sent:', info.messageId);
  } catch (err) {
    console.error('Error sending email:', err);
  }
};

// Function to log results to a file
const logToFile = (message) => {
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFile(config.logFilePath, logMessage, (err) => {
    if (err) {
      console.error('Error writing to log file:', err);
    }
  });
};

// Function to formate email body
const emailFormatter = ({ data, error }) => {
  const body = `
Hello there,

Our server hosting ${data.domain} is currently down. Our team is working to resolve the issue. We apologize for any inconvenience caused and will keep you updated on the progress.

Error : ${error}

Sincerely,
The team
@AllianceTek
`;
  return body;
};

// Function to reping the server
const rePingServer = async (data, i) => {
  try {
    const req = https.get(data.domain, (response) => {
      // Server is online
      // console.log(`re[Live] [${data.type}] [${data.tag}] : ${data.domain}`);
      logToFile(`re[Live] [${data.type}] [${data.tag}] : ${data.domain}`);
      if (response.statusCode === 503) {
        if (!mailSend[i]) {
          sendEmail({
            subject: 'Server down notification.',
            text: emailFormatter({
              data,
              error: JSON.stringify({
                statusCode: response.statusCode,
                message: response.statusMessage,
              }),
            }),
            to: data.failureEmailTo,
          });
          mailSend[i] = true;
        }
      }
      if (!mailSend[i]) mailSend[i] = true;
      response.resume(); // Consume response to free up resources
    });

    req.on('error', (error) => {
      // Server is unavailable
      // console.log(
      //   `re[Unavailable] [${data.type}] [${data.tag}] : ${data.domain}`
      // );
      logToFile(
        `re[Unavailable] [${data.type}] [${data.tag}] : ${data.domain}`
      );
      logToFile(`re[Error] ${error}`);
      if (!mailSend[i]) {
        sendEmail({
          subject: 'Server down notification.',
          text: emailFormatter({ data, error }),
          to: data.failureEmailTo,
        });
        mailSend[i] = true;
      }
    });
  } catch (err) {
    logToFile(`re[Crash] : ${err}`);
  }
};

// Function to ping the server
const pingServer = async () => {
  try {
    await Promise.all(
      config.pingUrls.map((data, i) => {
        const req = https.get(data.domain, (response) => {
          // Server is online
          // console.log(
          //   `[Live] [${data.type}] [${data.tag}] : ${data.domain} ${response.statusCode} ${response.statusMessage}`
          // );
          // logToFile(`[Live] [${data.type}] [${data.tag}] : ${data.domain}`);
          if (response.statusCode === 503) {
            setTimeout(async () => await rePingServer(data, i), 1000 * 60);
          } else {
            if (!mailSend[i]) mailSend[i] = true;
          }
          response.resume(); // Consume response to free up resources
        });
        req.on('error', (error) => {
          // Server is unavailable
          console.log(error);
          setTimeout(async () => await rePingServer(data, i), 1000 * 60);
        });
      })
    );
  } catch (err) {
    logToFile(`[Crash] : ${err}`);
  }
  setTimeout(pingServer, config.pingInterval); // Schedule next ping after interval
};

pingServer();
