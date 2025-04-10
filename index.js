const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const https = require('https');
const { parseStringPromise, Builder } = require('xml2js');
const fs = require('fs');
const path = require('path');

// Create Express app
const app = express();
const port = process.env.PORT || 5000;

// Session storage with persistence
const SESSION_FILE = path.join(__dirname, 'sessions.json');

// Load existing sessions if available
let sessions = new Map();
try {
  if (fs.existsSync(SESSION_FILE)) {
    const sessionsData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    sessions = new Map(sessionsData.map(([key, value]) => [key, { 
      ...value, 
      createdAt: new Date(value.createdAt) 
    }]));
    console.log(`Loaded ${sessions.size} sessions from disk`);
  }
} catch (error) {
  console.error('Error loading sessions:', error.message);
}

// Save sessions periodically and on shutdown
const saveSessions = () => {
  try {
    const sessionsData = Array.from(sessions.entries());
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionsData, null, 2));
    console.log(`Saved ${sessions.size} sessions to disk`);
  } catch (error) {
    console.error('Error saving sessions:', error.message);
  }
};

// Save every 5 minutes
setInterval(saveSessions, 5 * 60 * 1000);

// Save on process exit
process.on('SIGINT', () => {
  console.log('Shutting down...');
  saveSessions();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  saveSessions();
  process.exit(0);
});

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.text({ type: 'application/xml' }));
app.use(bodyParser.text({ type: 'text/plain' }));
app.use(bodyParser.urlencoded({ extended: true }));

// API token validation middleware
const validateToken = (req, res, next) => {
  const token = req.headers['x-api-token'];
  if (!token || token !== process.env.MCP_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Helper to create axios instance with appropriate settings
const createAxiosInstance = (baseURL, jsessionid = null) => {
  console.log(`Creating axios instance for ${baseURL}, jsessionid: ${jsessionid || 'none'}`);
  try {
    // Don't force port 443, use the URL as provided
    const instance = axios.create({
      baseURL,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false // -k in curl
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      maxRedirects: 5, // --location in curl
      timeout: 10000
    });
    
    if (jsessionid) {
      instance.defaults.headers.common['Cookie'] = `JSESSIONID=${jsessionid}`;
    }
    
    // Add request interceptor for debugging
    instance.interceptors.request.use(
      config => {
        console.log(`Making ${config.method.toUpperCase()} request to ${config.baseURL}${config.url}`);
        return config;
      },
      error => {
        console.error('Request error:', error.message);
        return Promise.reject(error);
      }
    );
    
    return instance;
  } catch (error) {
    console.error('Error creating axios instance:', error);
    throw new Error(`Failed to create client: ${error.message}`);
  }
};

// Login endpoint
app.post('/api/login', validateToken, async (req, res) => {
  try {
    const { host, username, password } = req.body;
    
    if (!host || !username || !password) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    console.log(`Login attempt for ${username}@${host}`);
    
    // Remove explicit port 443 to match curl command format
    const baseURL = `https://${host}`;
    console.log(`Using base URL: ${baseURL}`);
    
    // Create a client that exactly matches the curl command behavior
    const client = axios.create({
      baseURL,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false // -k in curl
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      maxRedirects: 5, // --location in curl
      timeout: 10000
    });
    
    console.log('Client created successfully');
    
    try {
      console.log('Attempting to authenticate...');
      // Use data-urlencode format exactly as in curl
      const formData = `j_username=${encodeURIComponent(username)}&j_password=${encodeURIComponent(password)}`;
      console.log(`POST to /admin/api/login with form data: j_username=${username}&j_password=***`);
      
      const response = await client.post('/admin/api/login', formData);
      console.log(`Authentication response status: ${response.status}`);
      
      // Extract JSESSIONID from response cookies
      const cookies = response.headers['set-cookie'];
      if (!cookies) {
        console.log('No cookies returned in response');
        return res.status(401).json({ error: 'Authentication failed - no cookies' });
      }
      
      console.log('Response cookies:', cookies);
      
      let jsessionid = null;
      for (const cookie of cookies) {
        const match = cookie.match(/JSESSIONID=([^;]+)/);
        if (match) {
          jsessionid = match[1];
          console.log(`Found JSESSIONID: ${jsessionid}`);
          break;
        }
      }
      
      if (!jsessionid) {
        console.log('No JSESSIONID found in cookies');
        return res.status(401).json({ error: 'Authentication failed - no JSESSIONID' });
      }
      
      // Generate a session key
      const sessionKey = Math.random().toString(36).substring(2, 15) + 
                        Math.random().toString(36).substring(2, 15);
      
      // Store session information
      sessions.set(sessionKey, {
        host,
        jsessionid,
        username,
        createdAt: new Date()
      });
      
      // After successful login and storing the session
      saveSessions(); // Save immediately after login
      console.log(`Login successful for ${username}@${host}, session created: ${sessionKey}`);
      
      return res.status(200).json({
        sessionKey,
        message: 'Login successful'
      });
    } catch (authError) {
      console.error('Authentication error details:', authError.message);
      if (authError.response) {
        console.error('Auth Error Response:', {
          status: authError.response.status,
          statusText: authError.response.statusText
        });
      }
      throw authError;
    }
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({
      error: 'Login failed',
      details: error.message
    });
  }
});

// Browse to Global Admin
app.post('/api/browse-global', validateToken, async (req, res) => {
  try {
    const { sessionKey } = req.body;
    
    if (!sessionKey || !sessions.has(sessionKey)) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    const session = sessions.get(sessionKey);
    const baseURL = `https://${session.host}`;
    const client = createAxiosInstance(baseURL, session.jsessionid);
    
    const response = await client.put('/admin/api/currentPortal', 
      '<val></val>',
      { 
        headers: { 'Content-Type': 'application/xml' }
      }
    );
    
    return res.status(200).json({
      message: 'Successfully browsed to global admin',
      status: response.status
    });
  } catch (error) {
    console.error('Browse to global error:', error.message);
    return res.status(500).json({
      error: 'Failed to browse to global admin',
      details: error.message
    });
  }
});

// List tenants
app.post('/api/list-tenants', validateToken, async (req, res) => {
  try {
    const { sessionKey, startFrom = 0, countLimit = 50 } = req.body;
    
    if (!sessionKey || !sessions.has(sessionKey)) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    const session = sessions.get(sessionKey);
    const baseURL = `https://${session.host}`;
    const client = createAxiosInstance(baseURL, session.jsessionid);
    
    // Step 1: Browse to Global Admin first
    console.log('Browsing to Global Admin...');
    try {
      const browseResponse = await client.put('/admin/api/currentPortal', 
        '<val></val>',
        { 
          headers: { 'Content-Type': 'application/xml' }
        }
      );
      
      console.log('Successfully browsed to Global Admin');
    } catch (browseError) {
      console.error('Error browsing to Global Admin:', browseError.message);
      return res.status(500).json({
        error: 'Failed to browse to Global Admin',
        details: browseError.message
      });
    }
    
    // Step 2: Now list tenants
    console.log('Listing tenants...');
    const xmlData = `<obj>
      <att id="type">
          <val>db</val>
      </att>
      <att id="name">
          <val>query</val>
      </att>
      <att id="param">
          <obj>
              <att id="startFrom">
                  <val>${startFrom}</val>
              </att>
              <att id="countLimit">
                  <val>${countLimit}</val>
              </att>
              <att id="include">
                  <list>
                      <val>name</val>
                  </list>
              </att>
          </obj>
      </att>
    </obj>`;
    
    const response = await client.post('/admin/api/portals',
      xmlData,
      { 
        headers: { 'Content-Type': 'text/plain' }
      }
    );
    
    console.log('Raw response:', response.data);
    
    // Parse XML response
    const result = await parseStringPromise(response.data);
    console.log('Parsed result:', JSON.stringify(result, null, 2));
    
    // Extract tenant names based on the actual XML structure
    const tenants = [];
    
    // Handle the QueryResult structure from the response
    if (result && result.obj && result.obj.att) {
      // Look for the 'objects' attribute that contains the list of tenants
      const objectsAtt = result.obj.att.find(att => att.$ && att.$.id === 'objects');
      
      if (objectsAtt && objectsAtt.list && objectsAtt.list[0] && objectsAtt.list[0].obj) {
        const tenantObjects = objectsAtt.list[0].obj;
        
        for (const tenantObj of tenantObjects) {
          if (tenantObj.att) {
            const nameAtt = tenantObj.att.find(att => att.$ && att.$.id === 'name');
            if (nameAtt && nameAtt.val && nameAtt.val[0]) {
              tenants.push(nameAtt.val[0]);
            }
          }
        }
      }
    }
    
    return res.status(200).json({
      tenants,
      count: tenants.length,
      startFrom,
      countLimit
    });
  } catch (error) {
    console.error('List tenants error:', error.message);
    return res.status(500).json({
      error: 'Failed to list tenants',
      details: error.message
    });
  }
});

// Get sessions
app.get('/api/sessions', validateToken, (req, res) => {
  const sessionList = [];
  
  for (const [key, session] of sessions.entries()) {
    sessionList.push({
      sessionKey: key,
      host: session.host,
      username: session.username,
      createdAt: session.createdAt
    });
  }
  
  return res.status(200).json({
    sessions: sessionList,
    count: sessionList.length
  });
});

// Logout
app.post('/api/logout', validateToken, async (req, res) => {
  try {
    const { sessionKey } = req.body;
    
    if (!sessionKey || !sessions.has(sessionKey)) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    const session = sessions.get(sessionKey);
    sessions.delete(sessionKey);
    
    // After deletion
    saveSessions(); // Save immediately after logout
    
    return res.status(200).json({
      message: 'Successfully logged out',
      sessionKey
    });
  } catch (error) {
    console.error('Logout error:', error.message);
    return res.status(500).json({
      error: 'Failed to logout',
      details: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: '0.1.0',
    activeSessions: sessions.size
  });
});

// Get session details for external tools 
app.get('/api/session/:sessionKey', validateToken, (req, res) => {
  const { sessionKey } = req.params;
  
  if (!sessionKey || !sessions.has(sessionKey)) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  
  const session = sessions.get(sessionKey);
  
  return res.status(200).json({
    host: session.host,
    username: session.username,
    jsessionid: session.jsessionid,
    createdAt: session.createdAt
  });
});

// Proxy requests to CTERA API
app.post('/api/proxy', validateToken, async (req, res) => {
  try {
    const { sessionKey, method = 'get', path, data = null, headers = {} } = req.body;
    
    if (!sessionKey || !sessions.has(sessionKey)) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    if (!path) {
      return res.status(400).json({ error: 'Missing path parameter' });
    }
    
    const session = sessions.get(sessionKey);
    const baseURL = `https://${session.host}`;
    const client = createAxiosInstance(baseURL, session.jsessionid);
    
    // Set additional headers
    Object.keys(headers).forEach(key => {
      client.defaults.headers.common[key] = headers[key];
    });
    
    // Make the request
    const response = await client({
      method: method.toLowerCase(),
      url: path,
      data: data,
    });
    
    // Return the response
    return res.status(response.status).json({
      status: response.status,
      data: response.data,
      headers: response.headers
    });
  } catch (error) {
    console.error('Proxy error:', error.message);
    return res.status(500).json({
      error: 'Proxy request failed',
      details: error.message
    });
  }
});

// MCP protocol endpoint with debugging
app.post('/mcp', (req, res) => {
  console.log('MCP POST endpoint hit with body:', JSON.stringify(req.body));
  console.log('MCP POST headers:', JSON.stringify(req.headers));
  
  // Continue with existing code
  validateToken(req, res, async () => {
    try {
      const { name, parameters } = req.body;
      
      console.log(`MCP call: ${name} with parameters:`, parameters);
      
      if (name === 'login') {
        const { host, username, password } = parameters;
        
        if (!host || !username || !password) {
          return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        // Create a client
        const baseURL = `https://${host}:443`;
        const client = axios.create({
          baseURL,
          httpsAgent: new https.Agent({
            rejectUnauthorized: false // -k in curl
          }),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          maxRedirects: 5,
          timeout: 10000
        });
        
        // Login
        try {
          const formData = `j_username=${encodeURIComponent(username)}&j_password=${encodeURIComponent(password)}`;
          const response = await client.post('/admin/api/login', formData);
          
          // Extract JSESSIONID from response cookies
          const cookies = response.headers['set-cookie'];
          if (!cookies) {
            return res.status(200).json({ 
              error: true,
              message: 'Authentication failed - no cookies' 
            });
          }
          
          let jsessionid = null;
          for (const cookie of cookies) {
            const match = cookie.match(/JSESSIONID=([^;]+)/);
            if (match) {
              jsessionid = match[1];
              break;
            }
          }
          
          if (!jsessionid) {
            return res.status(200).json({ 
              error: true,
              message: 'Authentication failed - no JSESSIONID' 
            });
          }
          
          // Generate a session key
          const sessionKey = Math.random().toString(36).substring(2, 15) + 
                            Math.random().toString(36).substring(2, 15);
          
          // Store session information
          sessions.set(sessionKey, {
            host,
            jsessionid,
            username,
            createdAt: new Date()
          });
          
          // Save sessions
          saveSessions();
          
          return res.status(200).json({
            sessionKey,
            message: 'Login successful'
          });
        } catch (error) {
          return res.status(200).json({
            error: true,
            message: `Login failed: ${error.message}`
          });
        }
      } else if (name === 'listTenants') {
        const { sessionKey } = parameters;
        
        if (!sessionKey || !sessions.has(sessionKey)) {
          return res.status(200).json({ 
            error: true,
            message: 'Invalid or expired session' 
          });
        }
        
        const session = sessions.get(sessionKey);
        const baseURL = `https://${session.host}`;
        const client = createAxiosInstance(baseURL, session.jsessionid);
        
        try {
          // Browse to Global Admin
          await client.put('/admin/api/currentPortal', 
            '<val></val>',
            { headers: { 'Content-Type': 'application/xml' } }
          );
          
          // List tenants
          const xmlData = `<obj>
            <att id="type">
                <val>db</val>
            </att>
            <att id="name">
                <val>query</val>
            </att>
            <att id="param">
                <obj>
                    <att id="startFrom">
                        <val>0</val>
                    </att>
                    <att id="countLimit">
                        <val>50</val>
                    </att>
                    <att id="include">
                        <list>
                            <val>name</val>
                        </list>
                    </att>
                </obj>
            </att>
          </obj>`;
          
          const response = await client.post('/admin/api/portals',
            xmlData,
            { headers: { 'Content-Type': 'text/plain' } }
          );
          
          // Parse XML response
          const result = await parseStringPromise(response.data);
          
          // Extract tenant names
          const tenants = [];
          if (result && result.obj && result.obj.att) {
            const objectsAtt = result.obj.att.find(att => att.$ && att.$.id === 'objects');
            
            if (objectsAtt && objectsAtt.list && objectsAtt.list[0] && objectsAtt.list[0].obj) {
              const tenantObjects = objectsAtt.list[0].obj;
              
              for (const tenantObj of tenantObjects) {
                if (tenantObj.att) {
                  const nameAtt = tenantObj.att.find(att => att.$ && att.$.id === 'name');
                  if (nameAtt && nameAtt.val && nameAtt.val[0]) {
                    tenants.push(nameAtt.val[0]);
                  }
                }
              }
            }
          }
          
          return res.status(200).json({
            tenants,
            count: tenants.length
          });
        } catch (error) {
          return res.status(200).json({
            error: true,
            message: `Failed to list tenants: ${error.message}`
          });
        }
      } else {
        return res.status(400).json({
          error: true,
          message: `Unknown function: ${name}`
        });
      }
    } catch (error) {
      console.error('MCP error:', error.message);
      return res.status(500).json({
        error: true,
        message: error.message
      });
    }
  });
});

// Standard MCP tools schema endpoint with debugging
app.get('/mcp', (req, res) => {
  console.log('MCP GET endpoint hit with headers:', JSON.stringify(req.headers));
  
  const schema = {
    functions: [
      {
        name: "login",
        description: "Login to a CTERA portal",
        parameters: {
          type: "object",
          properties: {
            host: {
              type: "string",
              description: "CTERA portal hostname or IP"
            },
            username: {
              type: "string",
              description: "Username for login"
            },
            password: {
              type: "string",
              description: "Password for login"
            }
          },
          required: ["host", "username", "password"]
        }
      },
      {
        name: "listTenants",
        description: "List tenants in the CTERA portal",
        parameters: {
          type: "object",
          properties: {
            sessionKey: {
              type: "string",
              description: "Session key from login"
            }
          },
          required: ["sessionKey"]
        }
      }
    ]
  };
  
  console.log('Returning MCP schema:', JSON.stringify(schema));
  res.json(schema);
});

// Register MCP Tools for Cursor
if (process.env.MCP_TOOLS_REGISTRATION === 'true') {
  const toolSchema = {
    "name": "CTERA SDK",
    "description": "CTERA SDK Tools for Cursor",
    "schema": {
      "functions": [
        {
          "name": "login",
          "description": "Login to a CTERA portal",
          "parameters": {
            "type": "object",
            "properties": {
              "host": {
                "type": "string",
                "description": "CTERA portal hostname or IP"
              },
              "username": {
                "type": "string",
                "description": "Username for login"
              },
              "password": {
                "type": "string",
                "description": "Password for login"
              }
            },
            "required": ["host", "username", "password"]
          }
        },
        {
          "name": "listTenants",
          "description": "List tenants in the CTERA portal",
          "parameters": {
            "type": "object",
            "properties": {
              "sessionKey": {
                "type": "string",
                "description": "Session key from login"
              }
            },
            "required": ["sessionKey"]
          }
        }
      ]
    }
  };

  // Create a dedicated endpoint for tools registration that Cursor can query
  app.get('/mcp-tools-schema', (req, res) => {
    res.json(toolSchema);
  });
  
  // Still log for backward compatibility
  console.log('MCP tools registration enabled');
}

// Start the server
app.listen(port, '0.0.0.0', () => {
  // Only output plain text logs without trying to format as JSON
  console.log(`CTERA SDK MCP server listening on port ${port}`);
  console.log(`API Token: ${process.env.MCP_API_TOKEN || '<not set>'}`);
}); 