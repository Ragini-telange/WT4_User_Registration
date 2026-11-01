
function validateRegistration(data) {
    const errors = [];

    const name = (data.name || "").trim();
    const email = (data.email || "").trim();
    const password = data.password || "";
    const confirmPassword = data.confirmPassword || "";

    // Check name
    if (name.length === 0) {
        errors.push("Name is required.");
    }

    // Check email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
        errors.push("Please enter a valid email address.");
    }

    // Check password length
    if (password.length < 8) {
        errors.push("Password must contain at least 8 characters.");
    }

    // Check password confirmation
    if (password !== confirmPassword) {
        errors.push("Passwords do not match.");
    }

    return errors;
}

module.exports = { validateRegistration };
