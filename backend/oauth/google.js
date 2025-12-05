const fetch = require('node-fetch');
const querystring = require('querystring');


const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://www.googleapis.com/oauth2/v2/userinfo';


function authUrl() {
const params = {
client_id: process.env.GOOGLE_CLIENT_ID,
redirect_uri: process.env.GOOGLE_REDIRECT_URI,
response_type: 'code',
scope: 'openid email profile',
access_type: 'offline',
include_granted_scopes: 'true',
prompt: 'consent',
};
return `${GOOGLE_AUTH_BASE}?${querystring.stringify(params)}`;
}


async function exchangeCodeForTokens(code) {
const body = {
code,
client_id: process.env.GOOGLE_CLIENT_ID,
client_secret: process.env.GOOGLE_CLIENT_SECRET,
redirect_uri: process.env.GOOGLE_REDIRECT_URI,
grant_type: 'authorization_code',
};
const res = await fetch(GOOGLE_TOKEN_URL, {
method: 'POST',
headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
body: querystring.stringify(body),
});
if (!res.ok) throw new Error(`[google token] ${res.status} ${await res.text()}`);
return res.json();
}


async function fetchUserInfo(accessToken) {
const res = await fetch(GOOGLE_USERINFO, {
headers: { Authorization: `Bearer ${accessToken}` },
});
if (!res.ok) throw new Error(`[google userinfo] ${res.status} ${await res.text()}`);
return res.json(); 
}


module.exports = { authUrl, exchangeCodeForTokens, fetchUserInfo }; 