
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
var express = require('express');
var app = express();

var mysql = require('mysql');
var bodyParser = require('body-parser');

app.use(bodyParser.json({ type: 'application/json' }));
app.use(bodyParser.urlencoded({ extended: true }));


var server = app.listen(4546, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log("start");
});

function connectToDatabase(companyId) {
  let databaseName;

  switch (companyId) {
    case 'swire':
      databaseName = 'swire';
      break;
    case 'chevalier':
      databaseName = 'timemoto';
      break;
    case 'headland':
      databaseName = 'timemoto';
      break;
    case 'demo':
      databaseName = 'demo';
      break;
    default:
      throw new Error("Invalid company_id");
  }

 return mysql.createConnection({
    host: "localhost",
    user: 'root',
    password: 'root',
    database: databaseName,
  });


}

var connection;
function authenticateToken(req, res, next) {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).send("Unauthorized");
  }

  jwt.verify(token, 'your_secret_key', (err, user) => {
    if (err) {
      return res.status(403).send("Forbidden");
    }

    req.user = user;
    const company_id = req.user.company_id;
    connection = connectToDatabase(company_id);
    next();
  });
}


//login endpoint
app.post('/login', function (req, res) {
  const login_code = req.body.login_code;
  const password = req.body.login_password;
  const company_id = req.body.company_id;
  const connection = connectToDatabase(company_id);

  connection.query('SELECT * FROM time_attendance WHERE device_login_code = ?', [login_code], function (error, rows, fields) {
    if (error) {
      console.log(error);
      res.status(500).send("Error during login");
    } else {
      if (rows.length > 0) {
        const storedHashedPassword = rows[0].password;
        bcrypt.compare(password, storedHashedPassword, function (err, passwordMatch) {
          if (err) {
            console.log(err);
            res.status(500).send("Error during login");
          } else {
            if (passwordMatch) {
              // Authentication successful, generate a token
              const username = rows[0].device_login_code;
              console.log(username);
              const expiresIn = 6 * 30 * 24 * 60 * 60; // 6 months in seconds
              const token = jwt.sign({
                username: username,
                company_id: company_id
              }, 'your_secret_key', { expiresIn: expiresIn });  // Token won't expire

              res.status(200).json({ token: token, login_code: username });
            } else {
              res.status(401).send("Invalid username or password");
            }
          }
        });
      } else {
        res.status(401).send("Invalid username or password");
      }
    }
  });
});

// Endpoint to get data_source_record_key based on login_code
app.get('/device/:login_code', authenticateToken, function (req, res) {
  const loginCode = req.params.login_code;
  console.log(loginCode);

  if (!loginCode) {
    return res.status(400).json({ error: 'login_code is required' });
  }

  const query = 'SELECT device_login_code, property_record_key, department_record_key, property_display_name, department_display_name, data_source_record_key, device_attendance_id, attendance_data_source_record_key FROM time_attendance WHERE device_login_code = ?';

  connection.query(query, [loginCode], function (error, rows) {
    if (error) {
      console.error(error);
      res.status(500).json({ error: 'Error retrieving data' });
    } else {
      if (rows.length === 1) {
        console.log(rows);
        res.status(200).json({ data: rows[0] });
      } else {
        // Device Data Source not found
        res.status(404).json({ error: 'Device Data Source not found' });
      }
    }
  });
});


