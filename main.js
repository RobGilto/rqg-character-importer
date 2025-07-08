/**
 * RQG Character Importer
 *
 * This module provides the client-side logic for importing a character generated
 * by the companion web application. It hooks into the Actors Directory render
 * to add an "Import" button and handles the file selection and data processing.
 */

// A unique ID for our module, used for settings and localization.
const MODULE_ID = 'rqg-character-importer';

/**
 * A helper function to localize strings.
 * @param {string} key - The localization key from the en.json file.
 * @returns {string} The localized string.
 */
const localize = (key) => game.i18n.localize(`${MODULE_ID}.${key}`);

/**
 * The main class responsible for handling the import logic.
 * This follows the principles outlined in the technical design document,
 * creating a robust import workflow.
 */
class CharacterImporter {
  /**
   * The main import function. It orchestrates the process of file selection,
   * reading, parsing, and creating the actor and its items.
   * This function is asynchronous to handle file reading and database operations.
   */
  static async importCharacter() {
    // 1. Use a file picker to get the JSON file from the user.
    const file = await this.selectJsonFile();
    if (!file) {
      // User cancelled the file picker.
      return;
    }

    // 2. Read the content of the file.
    let characterData;
    try {
      const jsonContent = await file.text();
      characterData = JSON.parse(jsonContent);
    } catch (error) {
      ui.notifications.error(localize('errors.invalidJson'));
      console.error(`${MODULE_ID} | Error parsing JSON file:`, error);
      return;
    }

    // 3. Validate the data structure. This is a basic check.
    // A more advanced implementation would have a full schema validation.
    if (!characterData.name || !characterData.type || !characterData.system || !Array.isArray(characterData.items)) {
      ui.notifications.error(localize('errors.invalidDataStructure'));
      return;
    }

    // Show a notification to the user that the import has started.
    ui.notifications.info(localize('notifications.importStarted').replace('{name}', characterData.name));

    try {
      // 4. Separate Actor data from Item data.
      const items = characterData.items;
      delete characterData.items; // Items will be created separately.

      // This is the "Compatibility Shim" layer.
      // If the RQG system updates, you can add data migration logic here
      // to transform the `characterData` and `items` from the old format
      // to the new one before creating the documents.
      // For example:
      // if (isOldSchema(characterData)) {
      //   characterData = migrateActorData(characterData);
      //   items = migrateItemsData(items);
      // }

      // 5. Create the Actor document.
      const actor = await Actor.create(characterData);
      if (!actor) {
        throw new Error("Actor creation failed for an unknown reason.");
      }

      // 6. Create the embedded Item documents.
      // This is the modern, recommended approach for Foundry VTT.
      // It ensures items are properly linked to their parent actor.
      await Item.create(items, { parent: actor });

      // 7. Success!
      ui.notifications.info(localize('notifications.importSuccess').replace('{name}', actor.name));

    } catch (error) {
      ui.notifications.error(localize('errors.importFailed'));
      console.error(`${MODULE_ID} | Character import failed:`, error);
    }
  }

  /**
   * Opens a file picker dialog for the user to select a .json file.
   * @returns {Promise<File|null>} A promise that resolves with the selected File object, or null if cancelled.
   */
  static selectJsonFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => {
        const file = input.files?.[0];
        resolve(file || null);
      };
      // Trigger the file picker dialog.
      input.click();
    });
  }
}


/**
 * Hooks are Foundry's way of letting modules interact with the core software.
 * We use the 'renderActorDirectory' hook to add our button.
 */
Hooks.on('renderActorDirectory', (app, html, data) => {
  // Find the footer of the actor directory sidebar.
  const footer = html.find('.directory-footer');
  if (!footer) {
    return;
  }

  // Create our custom button.
  const importButton = $(`
    <button class="rqg-importer-btn">
      <i class="fas fa-file-import"></i> ${localize('buttonLabel')}
    </button>
  `);

  // Add a click event listener to our button.
  importButton.on('click', (event) => {
    event.preventDefault();
    CharacterImporter.importCharacter();
  });

  // Add the button to the footer.
  footer.append(importButton);
});

console.log(`${MODULE_ID} | RQG Character Importer initialized.`);
