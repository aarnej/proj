loginButton = () => {
  let e = document.createElement('input');
  e.type = 'button';
  e.value = 'Log in';
  e.style.gridRow = 3;
  e.className = 'cell';
  e.addEventListener('click', async () => {
    await fetch("api/login", {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
      }),
    })
  });
  return e;
}

userNameInput = () => {
  let e = document.createElement('input');
  e.id = 'username'
  e.placeholder = 'Username';
  e.style.gridRow = 1;
  e.className = 'cell';
  return e;
}

passwordInput = () => {
  let e = document.createElement('input');
  e.id = 'password'
  e.type = 'password';
  e.placeholder = 'Password';
  e.style.gridRow = 2;
  e.className = 'cell';
  return e;
}

async function loginPage() {
  let classStyles = document.createElement('style');
  classStyles.innerHTML = `
    .cell {
      font-size: 3em;
      background-color: inherit;
    }
  `;
  document.head.appendChild(classStyles);

  document.body.style = `
     background-color: #333333;
  `;

  let div = document.createElement('div');
  div.style = `
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: grid;
  `;
  div.appendChild(userNameInput())
  div.appendChild(passwordInput());
  div.appendChild(loginButton());
  document.body.appendChild(div);
};

loginPage();
