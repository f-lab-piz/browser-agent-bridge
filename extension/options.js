const form = document.querySelector("form");
chrome.storage.local
  .get(["url", "profileName", "token", "autoDiscover"])
  .then((values) => {
    for (const [name, value] of Object.entries(values)) {
      if (name === "autoDiscover") form.elements[name].checked = value;
      else form.elements[name].value = value;
    }
  });
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  values.autoDiscover = form.elements.autoDiscover.checked;
  await chrome.storage.local.set(values);
  document.querySelector("#result").textContent =
    "저장했습니다. HTTP·stdio 연결을 자동으로 확인합니다.";
});
