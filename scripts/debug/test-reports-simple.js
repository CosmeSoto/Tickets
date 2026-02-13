// Test simple para verificar la API de reportes
const https = require('https');
const http = require('http');

async function testReportsAPI() {
  try {
    console.log('🧪 Probando API de reportes...');
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/reports?type=tickets',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      console.log('📊 Status:', res.statusCode);
      console.log('📊 Status Message:', res.statusMessage);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('📊 Response:', data);
        if (res.statusCode === 401) {
          console.log('❌ Error de autenticación - necesita login');
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Error:', error.message);
    });

    req.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testReportsAPI();