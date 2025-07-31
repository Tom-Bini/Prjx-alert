const supportBtn = document.getElementById("supportButton");
setInterval(() => {
    supportBtn.classList.add("highlight");
    setTimeout(() => {
        supportBtn.classList.remove("highlight");
    }, 1000); // durée de l'animation
}, 5000); // toutes les 5 secondes