document.addEventListener('DOMContentLoaded', () => {
  // Usamos tonConnectSdk y tonConnectUI desde window
  const tonConnect = new window.tonConnectSdk.TonConnect({
    manifestUrl: 'https://www.gemasino.com/tonconnect-manifest.json'
  });
  const tonConnectUI = new window.tonConnectUI.TonConnectUI(tonConnect);

  const connectWalletBtn = document.getElementById('connectWalletBtn');
  const statusText = document.getElementById('statusText');
  const walletInfoScreen = document.querySelector('.wallet-info-screen');
  const connectScreen = document.querySelector('.connect-screen');
  const walletAddressEl = document.querySelector('.wallet-address');
  const balanceAmountEl = document.querySelector('.balance-amount');
  const disconnectBtn = document.getElementById('disconnectBtn');
  const withdrawBtn = document.getElementById('withdrawBtn');
  const closeBtn = document.getElementById('closeBtn');

  connectWalletBtn.addEventListener('click', () => {
    tonConnectUI.showWalletList();
  });

  disconnectBtn.addEventListener('click', () => {
    tonConnect.disconnect();
  });

  withdrawBtn.addEventListener('click', () => {
    showToast("Withdraw action triggered (placeholder).");
  });

  closeBtn.addEventListener('click', () => {
    walletInfoScreen.style.display = 'none';
    connectScreen.style.display = 'block';
    statusText.textContent = "Please connect your TON Wallet.";
  });

  tonConnect.onStatusChange(async (walletInfo) => {
    if (walletInfo.account) {
      const tonAddress = walletInfo.account.address;
      // Aquí podrías pedir el balance a tu backend, por ahora fijo 100.000000
      let userBalance = 100.000000; 

      statusText.textContent = "Wallet conectada: " + tonAddress;
      walletAddressEl.textContent = tonAddress;
      balanceAmountEl.textContent = userBalance.toFixed(6);
      
      connectScreen.style.display = 'none';
      walletInfoScreen.style.display = 'block';

      showToast("Wallet conectada y balance cargado.");
    } else {
      // Desconectado
      statusText.textContent = "Usuario no conectado.";
      walletAddressEl.textContent = "N/A";
      balanceAmountEl.textContent = "0.000000";
      walletInfoScreen.style.display = 'none';
      connectScreen.style.display = 'block';
    }
  });

  function showToast(message) {
    const toast = document.querySelector('.toast-notification');
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 2000);
  }
});
