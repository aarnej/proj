let socket;
let accessToken;
let contentDiv;
let logoutButton;

let pathMatcher = new RegExp('[^/]*$')

function startup() {
  document.body.style.backgroundColor = '#333333';

  let classStyles = document.createElement('style');
  classStyles.innerHTML = `
    .cell-input, .cell-quiz, .logout, .menu {
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
      right: 0.5em;
      top: 0.5em;
    }
    .menu {
      position: fixed;
      left: 0.5em;
      top: 0.5em;
    }
    a:visited, a:link {
      color: black;
      text-decoration-color: #424242;
    }
  `;
  document.head.appendChild(classStyles);

  menuB = document.createElement('input');
  menuB.type = 'button';
  menuB.id = 'menu-button';
  menuB.value = 'Menu';
  menuB.className = 'menu';
  menuB.addEventListener('click', () => {
    navigate(routes.menu.pathname);
  });

  logoutButton = document.createElement('input');
  logoutButton.type = 'button';
  logoutButton.id = 'logout-button';
  logoutButton.value = 'Sign out';
  logoutButton.className = 'logout';
  logoutButton.addEventListener('click', () => {
    accessToken = 'logout';
    navigate(routes.login.pathname);
  });

  contentDiv = document.createElement('div');
  document.body.appendChild(contentDiv);
  document.body.appendChild(menuB);
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
  await fetchAccessToken();
  fetchParams.headers.Authorization = auth(accessToken);
  return await fetch(url, fetchParams);
}

async function loginPage() {
  function nextPage() {
    navigate(
      new URLSearchParams(window.location.search).get('return'),
      { replaceState: true },
    );
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
      document.getElementById('logout-button').style.display = 'initial';
      document.getElementById('menu-button').style.display = 'initial';
      div.remove();

      nextPage();
    }
  }

  form = document.createElement('form');
  div.appendChild(form)

  form.appendChild(userNameInput(tryLogin))
  form.appendChild(passwordInput(tryLogin));
  form.appendChild(loginButton(tryLogin));

  document.getElementById('logout-button').style.display = 'none';
  document.getElementById('menu-button').style.display = 'none';

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
    socket.onclose = async function() {
      await fetchAccessToken();
      openSocket();
    }
  }
}

function debounce(func, delay) {
  let timeout;
  return function(arg) {
    clearTimeout(timeout);
    timeout = setTimeout(func, delay, arg);
  }
}

async function wordEditor() {
  let search = new URLSearchParams();
  const url = new URL(window.location.href);
  const match = url.pathname.match('[^/]*$');
  const offset = match && match[0] || 0;
  search.append('offset', offset);
  search.append('limit', 7);
  let res = await myFetch('/api/words/?' + search.toString());
  if (!res.ok)
    return
  let json = await res.json()

  let div = document.createElement('div');
  div.className = 'center-grid';

  let row = 1;

  heading = document.createElement('h1');
  heading.className = 'cell-quiz';
  heading.style.gridRow = row++;
  heading.style.gridColumnStart = 1;
  heading.style.gridColumnEnd = 3;
  heading.style.marginBottom = '1em';
  heading.innerHTML = `Edit words`
  div.appendChild(heading);

  json.words.forEach(([lang_a, lang_b, lang_b_id]) => {
    let a = document.createElement('a');
    a.className = 'cell-quiz';
    a.style.gridRow = row;
    a.style.gridColumn = 1;
    a.innerHTML = lang_a;
    a.target = '_blank';
    a.href = `https://www.sanakirja.org/search.php?q=${lang_a}&l=22&l2=17`
    div.appendChild(a);

    let inputE = document.createElement('input');
    inputE.style.gridRow = row;
    inputE.style.gridColumn = 2;
    inputE.value = lang_b;
    inputE.className = 'cell-quiz';
    inputE.placeholder = 'translation';
    inputE.addEventListener('input', debounce(
      function(ev) {
        socket.send(JSON.stringify({
          type: 'edit-word',
          lang_b: ev.target.value,
          lang_b_id: lang_b_id,
        }));
      }, 250
    ));
    div.appendChild(inputE);
    row++;
  });

  if (json.offset > 0) {
    let newOffset = json.offset < json.limit ? 0 : json.offset - json.limit;
    let prevB = document.createElement('input');
    prevB.type = 'button';
    prevB.value = 'Previous';
    prevB.className = 'cell-input';
    prevB.style.gridRow = row++;
    prevB.style.gridColumnStart = 1;
    prevB.style.gridColumnEnd = 3;
    prevB.style.marginTop = '1em';
    prevB.addEventListener('click', () => {
      navigate(routes.editor.pathname + newOffset)
    });
    div.appendChild(prevB);
  }

  if (json.offset + json.limit < json.count) {
    let newOffset = json.offset + json.limit;
    let nextB = document.createElement('input');
    nextB.type = 'button';
    nextB.value = 'Next';
    nextB.className = 'cell-input';
    nextB.style.gridRow = row++;
    nextB.style.gridColumnStart = 1;
    nextB.style.gridColumnEnd = 3;
    nextB.style.marginTop = '1em';
    nextB.addEventListener('click', () => {
      navigate(routes.editor.pathname + newOffset)
    });
    div.appendChild(nextB);
  }

  if (!match || !match[0]) {
    url.pathname += offset;
    history.replaceState(undefined, routes.editor.title, url.toString())
  }
  contentDiv.appendChild(div);
}

async function wordQuiz() {
  const url = new URL(window.location.href);
  const match = url.pathname.match('[^/]*$');
  const date = match && match[0];
  let search = new URLSearchParams();
  if (date)
    search.append('date', date);

  let res = await myFetch('/api/quiz/?' + search.toString());
  if (res.ok) {
    let json = await res.json()

    let div = document.createElement('div');
    div.className = 'center-grid';

    let row = 1;

    heading = document.createElement('h1');
    heading.className = 'cell-quiz';
    heading.style.gridRow = row++;
    heading.style.gridColumnStart = 1;
    heading.style.gridColumnEnd = 3;
    heading.style.marginBottom = '1em';
    heading.innerHTML = `Quiz for ${json.date}`
    div.appendChild(heading);

    json.word_pairs.forEach(([lang_b_id, lang_a, input]) => {
      let span = document.createElement('span');
      span.className = 'cell-quiz';
      span.style.gridRow = row;
      span.style.gridColumn = 1;
      span.innerHTML = lang_a;
      div.appendChild(span);

      let inputE = document.createElement('input');
      inputE.style.gridRow = row;
      inputE.style.gridColumn = 2;
      inputE.value = input;
      inputE.className = 'cell-quiz';
      inputE.placeholder = 'translation';
      inputE.addEventListener('input', debounce(
        function(ev) {
          socket.send(JSON.stringify({
            type: 'word-quiz-input',
            input: ev.target.value,
            quiz_id: json.quiz_id,
            lang_b_id: lang_b_id,
          }));
        }, 250
      ));
      div.appendChild(inputE);
      row++;
    });

    if (json.prev_date) {
      let prevB = document.createElement('input');
      prevB.type = 'button';
      prevB.value = 'Previous';
      prevB.className = 'cell-input';
      prevB.style.gridRow = row++;
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
      nextB.style.gridRow = row++;
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
      history.replaceState(undefined, routes.quiz.title, url.toString())
    }

    contentDiv.appendChild(div);
  }
}

async function menu() {
  let div = document.createElement('div');
  div.className = 'center-flex';

  let buttons = [
    ['Word quiz', routes.quiz],
    ['Word editor', routes.editor],
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
  try {
    res = await fetch('/api/refresh/?' + search.toString(), {
      method: 'POST',
    });
  } catch(err) {
    console.log(err);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await fetchAccessToken();
  }

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
    openSocket();
    return res.ok;
  }

  const searchParams = new URLSearchParams();
  searchParams.append('return', window.location.pathname);
  navigate(routes.login.pathname, {
    replaceState: true,
    search: searchParams.toString(),
  });
  throw Error('must relogin');
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
  editor: {
    title: 'Word editor',
    pathname: '/word-editor/',
    handler: wordEditor,
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

  await fetchAccessToken()
  navigate(window.location.pathname, {
    replaceState: true,
  });
}

app();
