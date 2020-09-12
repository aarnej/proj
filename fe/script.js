var accessToken;
var contentDiv;
var logoutButton;

function startup() {
  document.body.style = `
     background-color: #333333;
  `;

  let classStyles = document.createElement('style');
  classStyles.innerHTML = `
    .cell-input, .cell-quiz, .logout {
      font-size: 3em;
      background-color: inherit;
    }
    .cell-quiz {
      margin: 0.2em;
      font-family: inherit;
    }
    .center-grid, .center-flex {
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
    }
    .center-grid {
      display: grid;
    }
    .center-flex {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
    }
    .logout {
      position: fixed;
      right: 0px;
      top: 0px;
    }
  `;
  document.head.appendChild(classStyles);

  logoutButton = document.createElement('input');
  logoutButton.type = 'button';
  logoutButton.value = 'Sign out';
  logoutButton.className = 'logout';
  logoutButton.addEventListener('click', () => {
    accessToken = 'logout';
    navigate(routes.login);
  });

  contentDiv = document.createElement('div');
  document.body.appendChild(contentDiv);
  document.body.appendChild(logoutButton);
}

async function myFetch(url, params) {
  const fetchParams = {
    ...params,
    headers: {
      ...(params && params.headers),
      'Authorization': `Bearer ${accessToken}`,
    },
  };

  if (accessToken) {
    res = await fetch(url, fetchParams);
    if (res.ok || res.status != 403)
      return res
  }
  if (await fetchAccessToken()) {
    return await fetch(url, fetchParams);
  }
  navigate(routes.login, ['return', window.location.pathname]);
  throw Error('must relogin');
}

async function loginPage() {
  function nextPage() {
    navigate(
      findRoute(new URLSearchParams(window.location.search).get('return'))
    );
  }

  if (await fetchAccessToken()) {
    nextPage();
    return;
  }

  function loginButton(onClick) {
    let e = document.createElement('input');
    e.type = 'button';
    e.value = 'Log in';
    e.style.gridRow = 3;
    e.className = 'cell-input';
    e.addEventListener('click', onClick)
    return e;
  }

  function enterHandler(onEnter) {
    function eventHandler(event) {
      if (event.keyCode == 13) {
        event.preventDefault();
        onEnter();
      }
    }
    return eventHandler;
  }

  function userNameInput(onEnter) {
    let e = document.createElement('input');
    e.id = 'username'
    e.placeholder = 'Username';
    e.style.gridRow = 1;
    e.className = 'cell-input';
    e.autocomplete = 'username';
    e.addEventListener('keyup', enterHandler(onEnter));
    return e;
  }

  function passwordInput(onEnter) {
    let e = document.createElement('input');
    e.id = 'password'
    e.type = 'password';
    e.placeholder = 'Password';
    e.style.gridRow = 2;
    e.className = 'cell-input';
    e.autocomplete = 'current-password';
    e.addEventListener('keyup', enterHandler(onEnter));
    return e;
  }

  async function login() {
    res = await fetch("/api/login/", {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
      }),
    });
    if (res.ok) {
      accessToken = (await res.json())['access_token'];
    }
    return res.ok;
  }

  let div = document.createElement('div');
  div.className = 'center-grid';

  async function tryLogin() {
    if (await login()) {
      div.remove();
      nextPage();
    }
  }

  form = document.createElement('form');
  div.appendChild(form)

  form.appendChild(userNameInput(tryLogin))
  form.appendChild(passwordInput(tryLogin));
  form.appendChild(loginButton(tryLogin));

  contentDiv.appendChild(div);
};

async function wordQuiz() {
  res = await myFetch('/api/quiz/');
  if (res.ok) {
    let div = document.createElement('div');
    div.className = 'center-grid';

    let json = await res.json()
    json.forEach((entry, index) => {
      let span = document.createElement('span');
      span.className = 'cell-quiz';
      span.style.gridRow = index;
      span.style.gridColumn = 1;
      span.innerHTML = entry[1];
      div.appendChild(span);

      let input = document.createElement('input');
      input.style.gridRow = index;
      input.style.gridColumn = 2;
      input.className = 'cell-quiz';
      input.placeholder = 'translation';
      div.appendChild(input);
    });

    contentDiv.appendChild(div);
  }
}

async function menu() {
  let div = document.createElement('div');
  div.className = 'center-flex';

  let buttons = [
    ['Word quiz', routes.quiz],
    ['Coming later', undefined],
    ['Coming later', undefined],
    ['Coming later', undefined],
  ].map(([text, route]) => {
    let e = document.createElement('input');
    e.className = 'cell-input';
    e.type = 'button';
    e.value = text;
    e.addEventListener('click', () => {
      div.remove();
      navigate(route);
    });
    return e;
  });

  buttons.forEach(button => div.appendChild(button));

  contentDiv.appendChild(div);
}

async function fetchAccessToken() {
  let search = new URLSearchParams();
  if (accessToken == 'logout')
    search.append('logout', 1);
  res = await fetch('/api/refresh/?' + search.toString(), {
    method: 'POST',
  });
  if (res.ok) {
    if (accessToken == 'logout') {
      accessToken = undefined;
      return false;
    }

    accessToken = (await res.json())['access_token'];
  }
  return res.ok;
}

const routes = {
  login: {
    title: 'Login',
    pathname: '/login/',
    handler: loginPage,
  },
  menu: {
    title: 'Menu',
    pathname: '/menu/',
    handler: menu,
  },
  quiz: {
    title: 'Word quiz',
    pathname: '/word-quiz/',
    handler: wordQuiz,
  },
}

function findRoute(pathname) {
  return Object.values(routes).find(route => route.pathname == pathname);
}

async function navigate(route, searchParam) {
  if (!route)
    route = routes.menu;
  const newUrl = new URL(window.location.href);
  newUrl.pathname = route.pathname;
  if (searchParam)
    newUrl.searchParams.set(...searchParam);
  else
    newUrl.search = '';;
  history.pushState(undefined, route.title, newUrl.toString());
  for (child of contentDiv.children)
    if (!(child instanceof HTMLScriptElement))
      child.remove()
  route.handler()
}

async function app() {
  startup();
  navigate(routes.login, ['return', window.location.pathname]);
  window.onpopstate = () => {
    navigate(findRoute(window.location.pathname));
  };
}

app();
