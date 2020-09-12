let accessToken = undefined;

loginButton = (onClick) => {
  let e = document.createElement('input');
  e.type = 'button';
  e.value = 'Log in';
  e.style.gridRow = 3;
  e.className = 'cell-input';
  e.addEventListener('click', onClick)
  return e;
}

userNameInput = () => {
  let e = document.createElement('input');
  e.id = 'username'
  e.placeholder = 'Username';
  e.style.gridRow = 1;
  e.className = 'cell-input';
  return e;
}

passwordInput = onEnter => {
  let e = document.createElement('input');
  e.id = 'password'
  e.type = 'password';
  e.placeholder = 'Password';
  e.style.gridRow = 2;
  e.className = 'cell-input';
  e.addEventListener('keyup', event => {
    if (event.keyCode == 13) {
      event.preventDefault();
      onEnter();
    }
  });
  return e;
}


function background() {
  document.body.style = `
     background-color: #333333;
  `;

  let classStyles = document.createElement('style');
  classStyles.innerHTML = `
    .cell-input, .cell-quiz {
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
  `;
  document.head.appendChild(classStyles);
}

async function login() {
  res = await fetch("/api/login", {
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

async function myFetch(url, params) {
  const fetchParams = {
    ...params,
    headers: {
      ...(params && params.headers),
      'Access-Token': accessToken,
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
      findRoute(new URLSearchParams(window.location.search).get('return')) ||
      routes.menu);
  }

  if (await fetchAccessToken()) {
    nextPage();
    return;
  }

  let div = document.createElement('div');
  div.className = 'center-grid';

  async function tryLogin() {
    if (await login()) {
      div.remove();
      nextPage();
    }
  }

  div.appendChild(userNameInput())
  div.appendChild(passwordInput(tryLogin));
  div.appendChild(loginButton(tryLogin));
  document.body.appendChild(div);
};

async function wordQuiz() {
  res = await myFetch('/api/quiz');
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

    document.body.appendChild(div);
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

  document.body.appendChild(div);
}

async function fetchAccessToken() {
  res = await fetch('/api/refresh', {
    method: 'POST',
  });
  if (res.ok) {
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
  const newUrl = new URL(window.location.href);
  newUrl.pathname = route.pathname;
  if (searchParam)
    newUrl.searchParams.set(...searchParam);
  else
    newUrl.search = '';;
  history.pushState(undefined, route.title, newUrl.toString());
  for (child of document.body.children)
    if (!(child instanceof HTMLScriptElement))
      child.remove()
  route.handler()
}

async function app() {
  background();
  navigate(routes.login, ['return', window.location.pathname]);
  window.onpopstate = () => {
    navigate(findRoute(window.location.pathname) || routes.menu);
  };
}

app();
