const axios = require('axios');
const api = axios.create({
  baseURL: 'https://zainzone-new-production.up.railway.app/api/v1',
});

async function test() {
  try {
    // We don't have auth, but let's see if we get a 401
    const res = await api.get('/clients?clientType=Personal');
    console.log('GET clients:', res.data.data.clients.length);
  } catch(e) {
    console.log('Error:', e.response ? e.response.data : e.message);
  }
}
test();
