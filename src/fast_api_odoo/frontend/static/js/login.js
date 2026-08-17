const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");


// =========================
// MOSTRAR / OCULTAR SENHA
// =========================

togglePassword.addEventListener("click", () => {

    const isPassword =
        passwordInput.type === "password";

    passwordInput.type =
        isPassword ? "text" : "password";

    togglePassword.textContent =
        isPassword ? "🔒" : "🔓";

    togglePassword.setAttribute(
        "aria-label",
        isPassword
            ? "Ocultar senha"
            : "Mostrar senha"
    );
});


// =========================
// SUBMIT
// =========================
loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    loginButton.disabled = true;
    loginButton.textContent = "Entrando...";

    const username = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {

        const response = await fetch("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        const data = await response.json();

        console.log("Resposta do FastAPI:", data);

        if (response.ok && data.success) {
            window.location.assign(data.redirect);
            return;
        }

        loginMessage.textContent = data.message || "Não foi possível realizar o login.";
        loginMessage.hidden = false;

    } catch (error) {

        console.error("Erro:", error);
        loginMessage.textContent = "Erro ao comunicar com o servidor.";
        loginMessage.hidden = false;

    } finally {

        loginButton.disabled = false;
        loginButton.textContent = "Entrar";

    }
});
