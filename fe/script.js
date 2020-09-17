var socket;
var accessToken;
var contentDiv;
var logoutButton;

let pathMatcher = new RegExp('[^/]*$')

function startup() {
  document.body.style.backgroundColor = '#333333';

  let classStyles = document.createElement('style');
  classStyles.innerHTML = `
    .cell-input, .cell-quiz, .logout {
      font-size: 3em;
      background-color: inherit;
      font-family: inherit;
    }
    .cell-quiz {
      margin: 0.2em;
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
    navigate(routes.login.pathname);
  });

  contentDiv = document.createElement('div');
  document.body.appendChild(contentDiv);
  document.body.appendChild(logoutButton);
}

async function myFetch(url, params) {
  function auth(token) {
    return `Bearer ${token}`;
  }

  const fetchParams = {
    ...params,
    headers: {
      ...(params && params.headers),
      Authorization: auth(accessToken),
    },
  };

  if (accessToken) {
    res = await fetch(url, fetchParams);
    if (res.ok || res.status != 403)
      return res
  }
  if (await fetchAccessToken()) {
    fetchParams.headers.Authorization = auth(accessToken);
    return await fetch(url, fetchParams);
  }
  const searchParams = new URLSearchParams();
  searchParams.append('return', window.location.pathname);
  navigate(routes.login.pathname, {
    replaceState: true,
    search: searchParams.toString(),
  });
  throw Error('must relogin');
}

async function loginPage() {
  function nextPage() {
    navigate(
      new URLSearchParams(window.location.search).get('return'),
      { replaceState: true },
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

function openSocket() {
  if (!socket || [2, 3].includes(socket.readyState)) {
    console.log('openSocket');
    let wsUrl = new URL(window.location.href)
    wsUrl.pathname = '/ws'
    wsUrl.protocol = 'wss'

    socket = new WebSocket(wsUrl);
    socket.onopen = function() {
      socket.send(accessToken);
    }
    socket.onclose = openSocket;
  }
}

async function wordQuiz() {
  const url = new URL(window.location.href);
  const match = url.pathname.match('[^/]*$');
  const date = match && match[0];
  let search = new URLSearchParams();
  if (date)
    search.append('date', date);

  res = await myFetch('/api/quiz/?' + search.toString());
  if (res.ok) {
    openSocket();

    let json = await res.json()

    let div = document.createElement('div');
    div.className = 'center-grid';

    json.word_pairs.forEach(([lang_b_id, lang_a, input], index) => {
      let span = document.createElement('span');
      span.className = 'cell-quiz';
      span.style.gridRow = index;
      span.style.gridColumn = 1;
      span.innerHTML = lang_a;
      div.appendChild(span);

      let inputE = document.createElement('input');
      inputE.style.gridRow = index;
      inputE.style.gridColumn = 2;
      inputE.value = input;
      inputE.className = 'cell-quiz';
      inputE.placeholder = 'translation';
      inputE.addEventListener('input', ev => {
        socket.send(JSON.stringify({
          type: 'word-quiz-input',
          input: ev.target.value,
          quiz_id: json.quiz_id,
          lang_b_id: lang_b_id,
        }));
      });
      div.appendChild(inputE);
    });

    if (json.prev_date) {
      let prevB = document.createElement('input');
      prevB.type = 'button';
      prevB.value = 'Previous';
      prevB.className = 'cell-input';
      prevB.style.gridRow = 6;
      prevB.style.gridColumnStart = 1;
      prevB.style.gridColumnEnd = 3;
      prevB.style.marginTop = '1em';
      prevB.addEventListener('click', () => {
        navigate(routes.quiz.pathname + json.prev_date)
      });
      div.appendChild(prevB);
    }

    if (json.next_date) {
      let nextB = document.createElement('input');
      nextB.type = 'button';
      nextB.value = 'Next';
      nextB.className = 'cell-input';
      nextB.style.gridRow = 7;
      nextB.style.gridColumnStart = 1;
      nextB.style.gridColumnEnd = 3;
      nextB.style.marginTop = '1em';
      nextB.addEventListener('click', () => {
        navigate(routes.quiz.pathname + json.next_date)
      });
      div.appendChild(nextB);
    }


    if (!date) {
      url.pathname += json.date;
      history.replaceState(undefined, 'Word quiz', url.toString())
    }

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
      navigate(route.pathname);
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
      if (socket) {
        socket.onclose = undefined
        socket.close();
        socket = null;
      }
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
  let page = pathname.replace(pathMatcher, '');
  return Object.values(routes).find(route =>
     route.pathname == page);
}

async function navigate(pathname, {
  search='',
  replaceState=false
} = {}) {
  let route = pathname && findRoute(pathname);
  if (!route) {
    route = routes.menu
    pathname = routes.menu.pathname;
  }
  const newUrl = new URL(window.location.href);
  newUrl.search = search;
  newUrl.pathname = pathname;
  if (replaceState) {
    history.replaceState(undefined, route.title, newUrl.toString());
  }
  else
    history.pushState(undefined, route.title, newUrl.toString());

  for (child of contentDiv.children)
    if (!(child instanceof HTMLScriptElement))
      child.remove()
  route.handler()
}

async function app() {
  startup();

  window.onpopstate = () => {
    navigate(window.location.pathname, { replaceState: true });
  };

  const searchParams = new URLSearchParams();
  searchParams.append('return', window.location.pathname);
  navigate(routes.login.pathname, {
    replaceState: true,
    search: searchParams.toString(),
  });
}

app();
