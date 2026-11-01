
const http = require("http");
const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");
const { validateRegistration } = require("./modules/validator");

const PORT = process.env.PORT || 3000;
const serverEvents = new EventEmitter();

const publicDir = path.join(__dirname, "public");
const usersFile = path.join(__dirname, "users.json");

// Create users.json if it does not exist
if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, "[]", "utf8");
}

// Handle successful registration event
serverEvents.on("registrationSuccess", (name) => {
    console.log(`New user registered successfully: ${name}`);
});

// Helper function to send a response
function sendResponse(res, statusCode, data) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8"
    });
    res.end(JSON.stringify(data));
}

// Create HTTP server
const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

    // Display registration page
    if (req.method === "GET" && pathname === "/") {
        const filePath = path.join(publicDir, "index.html");

        res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8"
        });

        fs.createReadStream(filePath)
            .on("error", (err) => {
                console.error("Unable to read registration page:", err.message);
                if (!res.headersSent) {
                    res.writeHead(500, {
                        "Content-Type": "text/plain; charset=utf-8"
                    });
                }
                if (!res.writableEnded) {
                    res.end("Unable to load the registration page.");
                }
            })
            .pipe(res);

        return;
    }

    // Serve CSS and JavaScript files
    if (req.method === "GET" &&
        (pathname === "/style.css" || pathname === "/script.js")) {
        const fileName = pathname.slice(1);
        const filePath = path.join(publicDir, fileName);
        const contentType = pathname.endsWith(".css")
            ? "text/css; charset=utf-8"
            : "text/javascript; charset=utf-8";

        res.writeHead(200, { "Content-Type": contentType });

        fs.createReadStream(filePath)
            .on("error", () => {
                if (!res.headersSent) {
                    res.writeHead(404, {
                        "Content-Type": "text/plain; charset=utf-8"
                    });
                }
                if (!res.writableEnded) {
                    res.end("File not found.");
                }
            })
            .pipe(res);

        return;
    }

    // Handle registration form submission
    if (req.method === "POST" && pathname === "/register") {
        let body = "";
        let tooLarge = false;

        req.on("data", (chunk) => {
            body += chunk.toString();

            if (Buffer.byteLength(body, "utf8") > 10000) {
                tooLarge = true;
                res.writeHead(413, {
                    "Content-Type": "application/json; charset=utf-8"
                });
                res.end(JSON.stringify({
                    success: false,
                    errors: ["Request is too large."]
                }));
                req.destroy();
            }
        });

        req.on("end", () => {
            if (tooLarge || res.writableEnded) return;

            let data;

            try {
                data = JSON.parse(body);
            } catch {
                sendResponse(res, 400, {
                    success: false,
                    errors: ["Invalid request data."]
                });
                return;
            }

            const errors = validateRegistration(data);

            if (errors.length > 0) {
                sendResponse(res, 400, {
                    success: false,
                    errors
                });
                return;
            }

            const name = data.name.trim();
            const email = data.email.trim().toLowerCase();

            let users;

            try {
                users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
                if (!Array.isArray(users)) throw new Error("Invalid users file");
            } catch {
                sendResponse(res, 500, {
                    success: false,
                    errors: ["Unable to read registration records."]
                });
                return;
            }

            // Prevent duplicate email registrations
            if (users.some(user => user.email === email)) {
                sendResponse(res, 409, {
                    success: false,
                    errors: ["This email is already registered."]
                });
                return;
            }

            // Never store plain-text passwords
            users.push({
                name,
                email,
                passwordLength: data.password.length,
                registeredAt: new Date().toISOString()
            });

            try {
                fs.writeFileSync(
                    usersFile,
                    JSON.stringify(users, null, 2),
                    "utf8"
                );
            } catch {
                sendResponse(res, 500, {
                    success: false,
                    errors: ["Unable to save registration."]
                });
                return;
            }

            serverEvents.emit("registrationSuccess", name);

            sendResponse(res, 201, {
                success: true,
                message: "Registration completed successfully!"
            });
        });

        return;
    }

    sendResponse(res, 404, {
        success: false,
        errors: ["Page or endpoint not found."]
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`User Registration Server running on port ${PORT}`);
});
