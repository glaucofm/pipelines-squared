const { app, ipcMain, BrowserWindow } = require('electron');
const fs = require('fs');
const fetch = require('node-fetch');

let window;

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';

const ipc = require('electron').ipcMain;

function createWindow () {

    window = new BrowserWindow({
        autoHideMenuBar: true,
        title: 'Pipelines Squared',
        webPreferences: {
            webSecurity: false,
            nodeIntegration: true
        }
    });

    window.loadURL(`file://${__dirname}/../../dist/angular/index.html`);

    // window.webContents.openDevTools();

    window.maximize();

    window.on('closed', function () {
        window = null;
    });

    app.on("window-all-closed", function () {
        app.quit();
    });

}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('activate', function () {
    if (window === null) {
        createWindow()
    }
});

/*
export interface ElectronRequest {
    id: string;
    method: 'GET' | 'POST';
    url: string;
    params?: { [key: string]: string };
    headers: { [key: string]: string };
    postData?: any;
}
 */

ipcMain.on("jenkins-request", async (event, data) => {
    if (data.method === 'GET') {
        window.webContents.send('jenkins-response', await doGet(data.id, data.url, data.params, data.headers));
    }
    if (data.method === 'POST') {
        window.webContents.send('jenkins-response', await doPost(data.id, data.url, data.params, data.headers, data.postData));
    }
});

async function doGet(id, url, params, headers) {
    let response = await fetch(url + getParameters(params), { headers: headers });
    return {
        id,
        text: await response.text(),
        headers: headersToMap(response.headers)
    }
}

async function doPost(id, url, params, headers, postData) {
    console.log('POST', url, postData? (typeof postData == 'string'? postData : JSON.stringify(postData)) : null, headers);
    let response = await fetch(url + getParameters(params), {
        method: 'POST',
        body: postData? (typeof postData == 'string'? postData : JSON.stringify(postData)) : null,
        headers: headers
    });
    let text = await response.text();
    console.log(response, text);
    return {
        id,
        text: text,
        headers: headersToMap(response.headers)
    }
}

function headersToMap(fetchHeaders) {
    let headers = {};
    fetchHeaders.forEach((value, key) => headers[key] = value);
    return headers;
}

function getParameters(params) {
    return params? '?' + Object.getOwnPropertyNames(params).map(x => x + '=' + escape(params[x])).join('&') : '';
}
