const MODULE_ID = "movement-speed-menu";
const MOVEMENT_TYPES = ["walk", "fly", "swim", "burrow", "climb", "crawl"];
const LABEL_CLASS = "movement-speed-menu-value";

Hooks.once("ready", () => {
  if (game.system.id !== "dnd5e") return;

  // Watch for the native movement palette being opened, but ignore mutations
  // caused by our own labels. This prevents a MutationObserver feedback loop.
  const observer = new MutationObserver((records) => {
    const externalChange = records.some((record) => !isOurOwnMutation(record));
    if (externalChange) updateMovementMenu();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  Hooks.on("controlToken", updateMovementMenu);
  Hooks.on("updateActor", updateMovementMenu);
  Hooks.on("updateToken", updateMovementMenu);
  console.log(`${MODULE_ID} | Ready`);
});

function isOurOwnMutation(record) {
  // Updating text inside our label.
  if (record.target instanceof Element && record.target.closest(`.${LABEL_CLASS}`)) return true;
  if (record.target instanceof Text && record.target.parentElement?.closest(`.${LABEL_CLASS}`)) return true;

  // Inserting/removing one of our labels changes its parent span's child list.
  if (record.type === "childList") {
    const changedNodes = [...record.addedNodes, ...record.removedNodes];
    if (changedNodes.length && changedNodes.every((node) =>
      node instanceof Element && (node.classList.contains(LABEL_CLASS) || node.closest(`.${LABEL_CLASS}`))
    )) return true;
  }
  return false;
}

function updateMovementMenu() {
  const palette = document.querySelector('#token-hud .palette[data-palette="movementActions"]');
  if (!palette) return;

  // Prefer the token whose HUD is currently open; fall back to a controlled token.
  const token = canvas.hud?.token?.object ?? canvas.tokens?.controlled?.[0] ?? canvas.tokens?.hover;
  const movement = token?.actor?.system?.attributes?.movement;
  if (!movement) return;

  // D&D 5e 6.x exposes the normalized values in movement.speeds.
  // Keep the legacy getters as a fallback for older system versions.
  const speedData = movement.speeds ?? {};
  const speeds = {
    walk: readSpeed(speedData.walk ?? movement.walk),
    fly: readSpeed(speedData.fly ?? movement.fly),
    swim: readSpeed(speedData.swim ?? movement.swim),
    burrow: readSpeed(speedData.burrow ?? movement.burrow),
    climb: readSpeed(speedData.climb ?? movement.climb)
  };
  speeds.crawl = speeds.walk === null ? null : speeds.walk / 2;

  for (const entry of palette.querySelectorAll('[data-action="movementAction"][data-movement-action]')) {
    const type = entry.dataset.movementAction;
    if (!MOVEMENT_TYPES.includes(type)) continue;

    let speedLabel = entry.querySelector(`.${LABEL_CLASS}`);
    const speed = speeds[type];

    if (speed === null || speed <= 0) {
      speedLabel?.remove();
      continue;
    }

    if (!speedLabel) {
      const label = entry.querySelector(":scope > span");
      if (!label) continue;
      speedLabel = document.createElement("span");
      speedLabel.className = LABEL_CLASS;
      speedLabel.style.marginLeft = "0.5em";
      speedLabel.style.opacity = "0.8";
      speedLabel.style.whiteSpace = "nowrap";
      speedLabel.style.float = "right";
      speedLabel.style.fontVariantNumeric = "tabular-nums";
      label.append(speedLabel);
    }

    const units = movement.units || "ft";
    const text = `${formatSpeed(speed)} ${units}`;
    if (speedLabel.textContent !== text) speedLabel.textContent = text;
  }
}

function readSpeed(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatSpeed(value) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}
