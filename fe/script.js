loginButton = (onClick) => {
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
    onClick();
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


function background() {
  document.body.style = `
     background-color: #333333;
  `;
}

function loginPage(afterLogin) {
  let classStyles = document.createElement('style');
  classStyles.innerHTML = `
    .cell {
      font-size: 3em;
      background-color: inherit;
    }
  `;
  document.head.appendChild(classStyles);

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
  div.appendChild(loginButton(() => {
    div.remove();
    classStyles.remove();
    afterLogin();
  }));
  document.body.appendChild(div);
};

function welcomePage() {
  e = document.createElement('h1')
  e.innerHTML = 'Welcome!';
  document.body.appendChild(e)
}

let accessToken = undefined;

async function fetchAccessToken() {
  res = await fetch('api/refresh', {
    method: 'POST'
  });
  if (res.ok) {
    accessToken = (await res.json())['access_token']
  }
}

async function app() {
  background();
  await fetchAccessToken();
  if (!accessToken) {
    loginPage(welcomePage);
  }
  else {
    welcomePage();
  }
}

app();