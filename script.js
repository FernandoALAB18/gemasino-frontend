const backendUrl = "https://gemasino-backend.onrender.com"; 
let currentUserId = ""; 
let publicKeyHex = "";

document.addEventListener('DOMContentLoaded', async () => {
  // Integración TonConnect
  const { TonConnect } = window.tonconnect;
  const { TonConnectUI } = window["tonconnect-ui"];

  const currentUserStatus = document.getElementById('currentUserStatus');
  const walletAddressEl = document.querySelector('.wallet-address');
  const avatarImgEl = document.querySelector('.avatar-img-no-circle');

  const tonConnect = new TonConnect({
    manifestUrl: 'https://www.gemasino.com/tonconnect-manifest.json'
  });
  const tonConnectUI = new TonConnectUI(tonConnect, {
    buttonRootId: 'ton-connect-button'
  });

  tonConnect.onStatusChange(async (walletInfo) => {
    if (walletInfo.account) {
      const tonAddress = walletInfo.account.address;
      publicKeyHex = walletInfo.account.publicKey; 

      // Pedimos challenge al backend
      const challengeRes = await fetch(`${backendUrl}/api/request-challenge`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ tonAddress })
      });
      const challengeData = await challengeRes.json();
      const challenge = challengeData.challenge;

      // Firmar challenge con TonConnect
      const messageBytes = new TextEncoder().encode(challenge);
      const signature = await tonConnect.signData(messageBytes);

      // Verificar firma en backend
      const verifyRes = await fetch(`${backendUrl}/api/verify-signature`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ tonAddress, publicKey: publicKeyHex, signature: signature.signature })
      });
      const verifyData = await verifyRes.json();
      if (verifyData.success) {
        currentUserId = tonAddress;
        currentUserStatus.textContent = "Usuario conectado: " + tonAddress;
        walletAddressEl.textContent = tonAddress;
        avatarImgEl.src = 'img/avatar.png';
        showToast("Wallet conectada y usuario autenticado.");
        getBalanceFromBackend(); 
      } else {
        showToast("No se pudo autenticar la wallet.");
      }

    } else {
      // Desconectado
      currentUserId = "";
      currentUserStatus.textContent = "Usuario no conectado";
      walletAddressEl.textContent = "15K6E9w...";
      avatarImgEl.src = 'img/avatar.png';
    }
  });

  // A partir de aquí, tu código original del script tal como lo proporcionaste,
  // con las funciones ya adaptadas al backend para minar y convertir gemas.

  const balanceAmountEl = document.querySelector('.balance-amount');

  function getLocalBalance() {
    return parseFloat(balanceAmountEl.textContent);
  }

  function setLocalBalance(value) {
    balanceAmountEl.textContent = value.toFixed(6);
  }

  // Función para obtener el balance desde el backend
  async function getBalanceFromBackend() {
    if (!currentUserId) {
      showToast("Primero establece un userId");
      return;
    }
    const res = await fetch(`${backendUrl}/api/get-balance?userId=${encodeURIComponent(currentUserId)}`);
    const data = await res.json();
    if (data.internalGems !== undefined) {
      setLocalBalance(data.internalGems);
      tokenDisplay.textContent = data.internalGems;
    } else {
      showToast('Error al obtener balance');
    }
  }

  // Función para minar llamando al backend
  async function mine() {
    if (!currentUserId) {
      showToast("Primero establece un userId");
      return;
    }
    const res = await fetch(`${backendUrl}/api/mine`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ userId: currentUserId })
    });
    const data = await res.json();
    if (data.success) {
      showToast("Has minado una gema!");
      getBalanceFromBackend();
      tapsToday++;
      gainXP(1);
    } else {
      showToast('Error al minar');
    }
  }

  // Función para convertir gemas internas a GEM on-chain
  async function convertInternalToGem() {
    if (!currentUserId) {
      showToast("Primero establece un userId");
      return;
    }
    let balance = getLocalBalance();
    if (balance <= 0) {
      showToast("No tienes tokens para convertir");
      return;
    }

    let amount = Math.floor(balance * 0.1);
    if (amount < 1) {
      showToast("No tienes suficientes gemas internas para convertir el 10%");
      return;
    }

    const res = await fetch(`${backendUrl}/api/convert-internal-to-gem`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ userId: currentUserId, amount })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Convertiste ${amount} gemas internas a GEM! txHash:${data.txHash}`);
      getBalanceFromBackend();
      mineTokens = 0; 
      updateMineUI();
    } else {
      showToast('Error en la conversión:' + (data.error || 'Desconocido'));
    }
  }

  let mineTokens = 0;
  let basePerTap = 1;
  let boostMultiplier = 1;
  let level = 1;
  let xp = 0;
  let xpForNextLevel = 1000;

  let boostActive = false;     
  let tripleBoostActive = false;
  let autoTapActive = false;   
  let boostTimeRemaining = 5 * 60 * 1000; 
  let tripleBoostTimeRemaining = 5 * 60 * 1000;
  let autoTapTimeRemaining = 3 * 60 * 1000; 
  let boostCost = 1000; 
  let tripleBoostCost = 2000;
  let autoTapInterval = null;
  let skinsBought = false;

  let tapsToday = 0;
  let boostsBought = 0;
  let kenoGemsGenerated = 0;
  let missionsClaimed = false;

  const gem = document.querySelector('.gem');
  const tokenDisplay = document.querySelector('.token-display');
  const convertBtn = document.querySelector('.convert-btn');
  const levelLabel = document.querySelector('.level-label');
  const perTapLabel = document.querySelector('.per-tap-label');

  const powersContainer = document.querySelector('.powers-container');
  const boostPowerItem = document.querySelector('.boost-power');
  const tripleBoostPowerItem = document.querySelector('.triple-boost-power');
  const tapPowerItem = document.querySelector('.tap-power');
  const boostTimerText = document.querySelector('.boost-timer-text');
  const tripleBoostTimerText = document.querySelector('.triple-boost-timer-text');
  const tapTimerText = document.querySelector('.tap-timer-text');

  const boostCostText = document.querySelector('.boost-cost-text');
  const tripleBoostCostText = document.querySelector('.triple-boost-cost-text');

  const buyBoostTokensBtn = document.querySelector('.buy-boost-tokens-btn');
  const buyTripleBoostBtn = document.querySelector('.buy-triple-boost-btn');
  const buySkinBtn = document.querySelector('.buy-skin-btn');
  const buyBoostCardBtn = document.querySelector('.buy-boost-card-btn');
  const buyBoostCryptoBtn = document.querySelector('.buy-boost-crypto-btn');

  const watchAdBtn = document.querySelector('.watch-ad-btn');
  const claimMissionsBtn = document.querySelector('.claim-missions-btn');
  const achievementsBtn = document.querySelector('.achievements-btn');
  const leaderboardBtn = document.querySelector('.leaderboard-btn');
  const backToTasksBtn = document.querySelector('.back-to-tasks-btn');
  const backToTasksBtn2 = document.querySelector('.back-to-tasks-btn2');

  const screenMine = document.querySelector('.screen-mine');
  const screenKeno = document.querySelector('.screen-keno');
  const screenStore = document.querySelector('.screen-store');
  const screenTasks = document.querySelector('.screen-tasks');
  const screenProfile = document.querySelector('.screen-profile');
  const screenAchievements = document.querySelector('.screen-achievements');
  const screenLeaderboard = document.querySelector('.screen-leaderboard');

  const mineTab = document.querySelector('.mine-tab');
  const kenoTab = document.querySelector('.keno-tab');
  const storeTab = document.querySelector('.store-tab');
  const tasksTab = document.querySelector('.tasks-tab');
  const profileTab = document.querySelector('.profile-tab');

  const profileGemsAmount = document.querySelector('.profile-gems-amount');
  const tonEquivalent = document.querySelector('.ton-equivalent');
  const usdtEquivalent = document.querySelector('.usdt-equivalent');
  const tonAmountSpan = document.querySelector('.ton-amount');
  const usdtAmountSpan = document.querySelector('.usdt-amount');
  const exchangeInput = document.querySelector('.exchange-input');
  const convertTonBtn = document.querySelector('.convert-ton-btn');
  const convertUsdtBtn = document.querySelector('.convert-usdt-btn');

  const achievement1Status = document.querySelector('.achievement-1-status');
  const achievement2Status = document.querySelector('.achievement-2-status');

  const GEM_TO_TON = 0.001; 
  const GEM_TO_USDT = 0.1;  

  const claimShuffleBtn = document.querySelector('.claim-shuffle-btn');
  const shuffleStatus = document.querySelector('.shuffle-status');
  const claimStakeBtn = document.querySelector('.claim-stake-btn');
  const stakeStatus = document.querySelector('.stake-status');

  const kenoButtons = document.querySelectorAll('.number-btn');
  const autoPickBtn = document.querySelector('.auto-pick-btn');
  const clearBtn = document.querySelector('.clear-btn');
  const betBtn = document.querySelector('.bet-btn');
  const betInput = document.querySelector('.bet-input');
  const gemZone = document.querySelector('.gem-zone');

  const tables = {
    1: {0:0.00,1:3.96},
    2: {0:0.00,1:0.00,2:17.10},
    3: {0:0.00,1:0.00,2:0.00,3:81.50},
    4: {0:0.00,1:0.00,2:0.00,3:10.00,4:259.00},
    5: {0:0.00,1:0.00,2:0.00,3:4.50,4:48.00,5:450.00},
    6: {0:0.00,1:0.00,2:0.00,3:0.00,4:11.00,5:350.00,6:710.00},
    7: {0:0.00,1:0.00,2:0.00,3:0.00,4:7.00,5:90.00,6:400.00,7:800.00},
    8: {0:0.00,1:0.00,2:0.00,3:0.00,4:5.00,5:20.00,6:270.00,7:600.00,8:900.00},
    9: {0:0.00,1:0.00,2:0.00,3:0.00,4:4.00,5:11.00,6:56.00,7:500.00,8:800.00,9:1000.00},
    10:{0:0.00,1:0.00,2:0.00,3:0.00,4:3.50,5:8.00,6:13.00,7:63.00,8:500.00,9:800.00,10:1000.00}
  };

  function showToast(message) {
    const toast = document.querySelector('.toast-notification');
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 2000);
  }

  function getCurrentPerTap() {
    return basePerTap * boostMultiplier;
  }

  function updateMineUI() {
    levelLabel.textContent = `LEVEL ${level}`;
    perTapLabel.textContent = `PER TAP +${getCurrentPerTap()}`;
    updateHalo();
  }

  function gainXP(amount) {
    xp += amount;
    if (xp >= xpForNextLevel) {
      xp -= xpForNextLevel;
      level++;
      basePerTap++;
      xpForNextLevel = Math.floor(xpForNextLevel * 1.5);
      showToast(`Subiste a nivel ${level}! Ahora generas ${getCurrentPerTap()} gemas/tap.`);
    }
    updateMineUI();
  }

  function updateBoostCostText() {
    boostCostText.textContent = `x2 Boost (5 min) - ${boostCost} Gems`;
    tripleBoostCostText.textContent = `x3 Boost (5 min) - ${tripleBoostCost} Gems`;
  }

  updateBoostCostText();

  function checkAchievementsAndMissions() {
    if (tapsToday>=1000) {
      achievement1Status.textContent = "Completado";
    }
    if (boostsBought>=10) {
      achievement2Status.textContent = "Completado";
    }
  }

  convertTonBtn.addEventListener('click', () => {
    let toConvert = parseFloat(exchangeInput.value);
    if (isNaN(toConvert) || toConvert<1) {
      showToast("Cantidad inválida");
      return;
    }
    let balance = getLocalBalance();
    if (balance<toConvert) {
      showToast("No tienes suficientes gems");
      return;
    }
    balance-= toConvert;
    setLocalBalance(balance);
    let tonReceived = (toConvert * GEM_TO_TON).toFixed(6);
    showToast(`Convertiste ${toConvert} gems a ${tonReceived} TON`);
  });

  convertUsdtBtn.addEventListener('click', () => {
    let toConvert = parseFloat(exchangeInput.value);
    if (isNaN(toConvert) || toConvert<1) {
      showToast("Cantidad inválida");
      return;
    }
    let balance = getLocalBalance();
    if (balance<toConvert) {
      showToast("No tienes suficientes gems");
      return;
    }
    balance-= toConvert;
    setLocalBalance(balance);
    let usdtReceived = (toConvert * GEM_TO_USDT).toFixed(2);
    showToast(`Convertiste ${toConvert} gems a ${usdtReceived} USDT`);
  });

  function showMine() {
    hideAllScreens();
    screenMine.style.display = 'block';
    mineTab.classList.add('active');
  }

  function showKeno() {
    hideAllScreens();
    screenKeno.style.display = 'block';
    kenoTab.classList.add('active');
  }

  function showStore() {
    hideAllScreens();
    screenStore.style.display = 'block';
    storeTab.classList.add('active');
  }

  function showTasks() {
    hideAllScreens();
    screenTasks.style.display = 'block';
    tasksTab.classList.add('active');
  }

  function showProfile() {
    hideAllScreens();
    screenProfile.style.display = 'block';
    profileTab.classList.add('active');
    updateProfile();
  }

  function showAchievements() {
    hideAllScreens();
    screenAchievements.style.display = 'block';
  }

  function showLeaderboard() {
    hideAllScreens();
    screenLeaderboard.style.display = 'block';
  }

  function hideAllScreens() {
    screenMine.style.display='none';
    screenKeno.style.display='none';
    screenStore.style.display='none';
    screenTasks.style.display='none';
    screenProfile.style.display='none';
    screenAchievements.style.display='none';
    screenLeaderboard.style.display='none';

    mineTab.classList.remove('active');
    kenoTab.classList.remove('active');
    storeTab.classList.remove('active');
    tasksTab.classList.remove('active');
    profileTab.classList.remove('active');
  }

  function updateProfile() {
    let currentBalance = getLocalBalance();
    profileGemsAmount.textContent = currentBalance.toLocaleString('en-US');
    tonAmountSpan.textContent = (currentBalance * GEM_TO_TON).toFixed(6);
    usdtAmountSpan.textContent = (currentBalance * GEM_TO_USDT).toFixed(6);
  }

  mineTab.addEventListener('click', showMine);
  kenoTab.addEventListener('click', showKeno);
  storeTab.addEventListener('click', showStore);
  tasksTab.addEventListener('click', showTasks);
  profileTab.addEventListener('click', showProfile);

  function formatTime(ms) {
    let secs = Math.floor(ms / 1000);
    let m = Math.floor(secs/60);
    let s = secs % 60;
    return `${m}m ${s<10?'0'+s:s}s`;
  }

  function updateTimers() {
    if (tripleBoostActive) {
      tripleBoostTimeRemaining-=1000;
      if (tripleBoostTimeRemaining<=0) {
        tripleBoostActive=false;
        if (boostActive) {
          boostMultiplier=2; 
        } else {
          boostMultiplier=1;
        }
        tripleBoostTimeRemaining=0;
        showToast("x3 Boost finalizado");
      } else {
        tripleBoostTimerText.textContent=formatTime(tripleBoostTimeRemaining);
      }
    } else if (boostActive) {
      boostTimeRemaining -= 1000;
      if (boostTimeRemaining<=0) {
        boostActive=false;
        boostMultiplier=1;
        boostTimeRemaining=0;
        showToast("x2 Boost finalizado");
      } else {
        boostTimerText.textContent=formatTime(boostTimeRemaining);
      }
    }

    if (autoTapActive) {
      autoTapTimeRemaining -= 1000;
      if (autoTapTimeRemaining<=0) {
        autoTapActive=false;
        if (autoTapInterval) {
          clearInterval(autoTapInterval);
          autoTapInterval=null;
        }
        autoTapTimeRemaining=0;
        showToast("Auto-tap finalizado");
      } else {
        tapTimerText.textContent=formatTime(autoTapTimeRemaining);
      }
    }

    updatePowersUI();
    updateMineUI();
  }

  setInterval(updateTimers, 1000);

  function updatePowersUI() {
    let anyPower = (boostActive || tripleBoostActive || autoTapActive);
    powersContainer.style.display = anyPower ? 'flex':'none';

    boostPowerItem.style.display = (boostActive && !tripleBoostActive) ? 'flex' : 'none';
    tripleBoostPowerItem.style.display = tripleBoostActive ? 'flex' : 'none';
    tapPowerItem.style.display = autoTapActive ? 'flex' : 'none';
  }

  function updateHalo() {
    gem.classList.remove('gem-halo-x2','gem-halo-x3');
    if (tripleBoostActive) {
      gem.classList.add('gem-halo-x3');
    } else if (boostActive) {
      gem.classList.add('gem-halo-x2');
    }
  }

  backToTasksBtn.addEventListener('click', showTasks);
  backToTasksBtn2.addEventListener('click', showTasks);

  async function claimExternalTask(taskName) {
    // Placeholder: sin implementar backend real para tasks.
    return {success:false};
  }

  claimShuffleBtn.addEventListener('click', async () => {
    shuffleStatus.style.display = 'block';
    shuffleStatus.textContent = 'Verificando...';
    const result = await claimExternalTask('shuffle');
    if (result.success) {
      shuffleStatus.textContent = '¡Recompensa acreditada! +200 gems';
      let balance = getLocalBalance();
      balance += 200;
      setLocalBalance(balance);
    } else {
      shuffleStatus.textContent = 'No se ha verificado la tarea aún. Intenta más tarde.';
    }
  });

  claimStakeBtn.addEventListener('click', async () => {
    stakeStatus.style.display = 'block';
    stakeStatus.textContent = 'Verificando...';
    const result = await claimExternalTask('stake');
    if (result.success) {
      stakeStatus.textContent = '¡Recompensa acreditada! +200 gems';
      let balance = getLocalBalance();
      balance += 200;
      setLocalBalance(balance);
    } else {
      stakeStatus.textContent = 'No se ha verificado la tarea aún. Intenta más tarde.';
    }
  });

  function toggleSelection(btn) {
    const selectedCount = document.querySelectorAll('.number-btn.selected').length;
    if (btn.classList.contains('selected')) {
      btn.classList.remove('selected');
    } else {
      if (selectedCount < 10) {
        btn.classList.add('selected');
      } else {
        showToast("No puedes seleccionar más de 10 casillas.");
      }
    }
  }

  kenoButtons.forEach(b => {
    b.addEventListener('click', () => {
      toggleSelection(b);
    });
  });

  autoPickBtn.addEventListener('click', () => {
    kenoButtons.forEach(b => b.classList.remove('selected'));
    const chosen = generateResults(10, 1, 40);
    chosen.forEach(num => {
      const btn = document.querySelector(`.number-btn[data-number="${num}"]`);
      if (btn) btn.classList.add('selected');
    });
  });

  clearBtn.addEventListener('click', () => {
    kenoButtons.forEach(b => b.classList.remove('selected'));
  });

  function generateResults(count, min, max) {
    const nums = new Set();
    while (nums.size < count) {
      const r = Math.floor(Math.random()*(max-min+1))+min;
      nums.add(r);
    }
    return Array.from(nums);
  }

  betBtn.addEventListener('click', () => {
    let balance = getLocalBalance();
    let bet = parseInt(betInput.value, 10);
    if (isNaN(bet) || bet < 1) {
      bet = 1;
      betInput.value = 1;
    }

    kenoButtons.forEach(b => {
      b.classList.remove('win','miss');
      b.textContent = b.getAttribute('data-number');
    });

    const chosenCount = document.querySelectorAll('.number-btn.selected').length;

    if (bet > balance) {
      showToast("No tienes suficiente balance para apostar");
      return; 
    }

    balance -= bet; 
    setLocalBalance(balance);

    if (chosenCount < 1 || chosenCount > 10) {
      showToast("Selecciona entre 1 y 10 casillas antes de apostar.");
      return;
    }

    const results = generateResults(10, 1, 40);
    let hits = 0;

    results.forEach(num => {
      const btn = document.querySelector(`.number-btn[data-number="${num}"]`);
      if (!btn) return;
      if (btn.classList.contains('selected')) {
        btn.classList.add('win');
        const img = document.createElement('img');
        img.src = 'img/gema-casilla.png'; 
        img.alt = 'Gem Casilla';
        img.style.width = '80%';
        img.style.height = '80%';
        btn.textContent = '';
        btn.appendChild(img);
        hits++;
      } else {
        btn.classList.add('miss');
      }
    });

    let multiplier = 0.00;
    if (tables[chosenCount] && typeof tables[chosenCount][hits] !== 'undefined') {
      multiplier = tables[chosenCount][hits];
    }

    const profit = bet * multiplier;
    balance += profit;
    setLocalBalance(balance);

    if (profit > 0) {
      showToast(`¡Ganaste ${profit.toFixed(2)} tokens!`);
    } else {
      showToast("No hubo ganancias esta vez.");
    }
  });

  showMine();
  updateMineUI();
});
