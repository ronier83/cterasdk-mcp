#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

program
  .name('cterasdk-mcp')
  .description('CLI for CTERA SDK MCP')
  .version('0.1.0');

program
  .command('start')
  .description('Start the MCP server')
  .option('-t, --token <token>', 'MCP API token', 'default_token')
  .option('-p, --port <port>', 'Port to run on', '5000')
  .action((options) => {
    console.log('Starting CTERA SDK MCP server...');
    console.log(`Using port: ${options.port}`);
    
    // Set environment variables
    process.env.MCP_API_TOKEN = options.token;
    process.env.PORT = options.port;
    
    // Start the server by requiring the main module
    require(path.join(__dirname, 'index.js'));
  });

program
  .command('login')
  .description('Login to a CTERA portal')
  .requiredOption('-h, --host <host>', 'CTERA portal hostname or IP')
  .requiredOption('-u, --username <username>', 'Username')
  .requiredOption('-p, --password <password>', 'Password')
  .option('-t, --token <token>', 'MCP API token', 'default_token')
  .option('--port <port>', 'Local server port', '5000')
  .action(async (options) => {
    try {
      console.log(`Logging in to ${options.host} as ${options.username}...`);
      
      // Make a POST request to the local server
      const data = JSON.stringify({
        host: options.host,
        username: options.username,
        password: options.password
      });
      
      const reqOptions = {
        hostname: 'localhost',
        port: options.port,
        path: '/api/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          'X-API-Token': options.token
        }
      };
      
      const req = http.request(reqOptions, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            const result = JSON.parse(responseData);
            console.log(`Successfully logged in to ${options.host}`);
            console.log(`Session Key: ${result.sessionKey}`);
            console.log(`Use this session key for subsequent commands.`);
          } else {
            console.error(`Login failed: ${responseData}`);
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`Error: ${error.message}`);
        console.error('Make sure the MCP server is running. Use "cterasdk-mcp start" to start it.');
      });
      
      req.write(data);
      req.end();
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  });

program
  .command('list-tenants')
  .description('List tenants')
  .requiredOption('-s, --session-key <sessionKey>', 'Session key from login')
  .option('-t, --token <token>', 'MCP API token', 'default_token')
  .option('--port <port>', 'Local server port', '5000')
  .action(async (options) => {
    try {
      // Make a POST request to the local server
      const data = JSON.stringify({
        sessionKey: options.sessionKey
      });
      
      // List tenants (server now handles browsing to global automatically)
      const listOptions = {
        hostname: 'localhost',
        port: options.port,
        path: '/api/list-tenants',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          'X-API-Token': options.token
        }
      };
      
      const listReq = http.request(listOptions, (listRes) => {
        let listData = '';
        
        listRes.on('data', (chunk) => {
          listData += chunk;
        });
        
        listRes.on('end', () => {
          if (listRes.statusCode === 200) {
            const result = JSON.parse(listData);
            console.log('Tenants:');
            if (result.tenants.length === 0) {
              console.log('No tenants found');
            } else {
              result.tenants.forEach((tenant, index) => {
                console.log(`${index + 1}. ${tenant}`);
              });
              console.log(`\nTotal: ${result.count} tenants`);
            }
          } else {
            console.error(`List tenants failed: ${listData}`);
          }
        });
      });
      
      listReq.on('error', (error) => {
        console.error(`Error: ${error.message}`);
        console.error('Make sure the MCP server is running. Use "cterasdk-mcp start" to start it.');
      });
      
      listReq.write(data);
      listReq.end();
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  });

program
  .command('list-sessions')
  .description('List active sessions')
  .option('-t, --token <token>', 'MCP API token', 'default_token')
  .option('--port <port>', 'Local server port', '5000')
  .action(async (options) => {
    try {
      const reqOptions = {
        hostname: 'localhost',
        port: options.port,
        path: '/api/sessions',
        method: 'GET',
        headers: {
          'X-API-Token': options.token
        }
      };
      
      const req = http.request(reqOptions, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            const result = JSON.parse(responseData);
            console.log('Active sessions:');
            if (result.sessions.length === 0) {
              console.log('No active sessions');
            } else {
              result.sessions.forEach((session, index) => {
                console.log(`${index + 1}. Host: ${session.host}, User: ${session.username}`);
                console.log(`   Session Key: ${session.sessionKey}`);
                console.log(`   Created: ${new Date(session.createdAt).toLocaleString()}`);
                console.log('');
              });
              console.log(`\nTotal: ${result.count} sessions`);
            }
          } else {
            console.error(`List sessions failed: ${responseData}`);
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`Error: ${error.message}`);
        console.error('Make sure the MCP server is running. Use "cterasdk-mcp start" to start it.');
      });
      
      req.end();
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  });

program
  .command('logout')
  .description('Logout from a session')
  .requiredOption('-s, --session-key <sessionKey>', 'Session key to logout from')
  .option('-t, --token <token>', 'MCP API token', 'default_token')
  .option('--port <port>', 'Local server port', '5000')
  .action(async (options) => {
    try {
      const data = JSON.stringify({
        sessionKey: options.sessionKey
      });
      
      const reqOptions = {
        hostname: 'localhost',
        port: options.port,
        path: '/api/logout',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          'X-API-Token': options.token
        }
      };
      
      const req = http.request(reqOptions, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log(`Successfully logged out session: ${options.sessionKey}`);
          } else {
            console.error(`Logout failed: ${responseData}`);
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`Error: ${error.message}`);
        console.error('Make sure the MCP server is running. Use "cterasdk-mcp start" to start it.');
      });
      
      req.write(data);
      req.end();
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  });

program
  .command('kill')
  .description('Kill any process running on the specified port')
  .option('-p, --port <port>', 'Port to kill process on', '5000')
  .action((options) => {
    console.log(`Attempting to kill process on port ${options.port}...`);
    const findCmd = process.platform === 'win32' 
      ? `netstat -ano | findstr :${options.port}`
      : `lsof -i :${options.port} | grep LISTEN`;
    
    const find = spawn(process.platform === 'win32' ? 'cmd.exe' : 'sh', 
                      [process.platform === 'win32' ? '/c' : '-c', findCmd], 
                      { stdio: 'pipe' });
    
    let output = '';
    find.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    find.on('close', (code) => {
      if (code !== 0 || !output) {
        console.log(`No process found using port ${options.port}`);
        return;
      }
      
      console.log('Found process:');
      console.log(output);
      
      const killCmd = process.platform === 'win32'
        ? `FOR /F "tokens=5" %i in ('netstat -ano ^| findstr :${options.port} ^| findstr LISTENING') do taskkill /F /PID %i`
        : `lsof -ti:${options.port} | xargs kill -9`;
      
      console.log(`Running command: ${killCmd}`);
      const kill = spawn(process.platform === 'win32' ? 'cmd.exe' : 'sh',
                        [process.platform === 'win32' ? '/c' : '-c', killCmd],
                        { stdio: 'inherit' });
      
      kill.on('close', (code) => {
        if (code === 0) {
          console.log(`Successfully killed process on port ${options.port}`);
        } else {
          console.error(`Failed to kill process on port ${options.port}`);
        }
      });
    });
  });

program
  .command('proxy')
  .description('Send a custom request to the CTERA portal')
  .requiredOption('-s, --session-key <sessionKey>', 'Session key from login')
  .requiredOption('-p, --path <path>', 'API path to call')
  .option('-m, --method <method>', 'HTTP method (GET, POST, PUT, DELETE)', 'GET')
  .option('-d, --data <data>', 'JSON data to send')
  .option('-t, --token <token>', 'MCP API token', 'default_token')
  .option('--port <port>', 'Local server port', '5000')
  .action(async (options) => {
    try {
      const data = JSON.stringify({
        sessionKey: options.sessionKey,
        method: options.method,
        path: options.path,
        data: options.data ? JSON.parse(options.data) : null
      });
      
      const reqOptions = {
        hostname: 'localhost',
        port: options.port,
        path: '/api/proxy',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          'X-API-Token': options.token
        }
      };
      
      const req = http.request(reqOptions, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const result = JSON.parse(responseData);
              console.log('Response:');
              console.log(JSON.stringify(result.data, null, 2));
            } catch (e) {
              console.log(responseData);
            }
          } else {
            console.error(`Request failed: ${responseData}`);
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`Error: ${error.message}`);
        console.error('Make sure the MCP server is running. Use "cterasdk-mcp start" to start it.');
      });
      
      req.write(data);
      req.end();
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
} 