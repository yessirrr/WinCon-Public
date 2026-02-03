/**
 * Shop Cost Registry - Single source of truth for VALORANT item costs.
 * Loads from data/valorant_shop_costs.json and provides lookup maps.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// --- Registry ---
let weaponsByName;
let weaponsByUuid;
let armorByName;
let armorByUuid;
let abilitiesByAgent;
let pistolLegalWeapons;
let pistolLegalArmor;
let initialized = false;
function normalizeAgentName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function normalizeItemName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}
export function loadShopCosts() {
    if (initialized)
        return;
    // Resolve path relative to this module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const jsonPath = path.resolve(__dirname, '../../data/valorant_shop_costs.json');
    if (!fs.existsSync(jsonPath)) {
        throw new Error(`Shop costs file not found: ${jsonPath}`);
    }
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const items = JSON.parse(rawData);
    // Initialize maps
    weaponsByName = new Map();
    weaponsByUuid = new Map();
    armorByName = new Map();
    armorByUuid = new Map();
    abilitiesByAgent = new Map();
    pistolLegalWeapons = [];
    pistolLegalArmor = [];
    for (const item of items) {
        if (item.itemType === 'weapon') {
            const cost = item.cost ?? 0;
            const category = item.category ?? 'Unknown';
            const isPistolLegal = cost <= 800 && category === 'Sidearms';
            const info = {
                name: item.name,
                uuid: item.uuid,
                cost,
                category,
                isPistolLegal,
            };
            weaponsByName.set(normalizeItemName(item.name), info);
            if (item.uuid) {
                weaponsByUuid.set(item.uuid, info);
            }
            if (isPistolLegal) {
                pistolLegalWeapons.push(info);
            }
        }
        else if (item.itemType === 'armor' || item.itemType === 'gear') {
            // Both armor and gear types can be shields
            if (item.category === 'Shields' || item.name.toLowerCase().includes('armor') || item.name.toLowerCase().includes('shield')) {
                const cost = item.cost ?? 0;
                const isPistolLegal = cost <= 800;
                const info = {
                    name: item.name,
                    uuid: item.uuid,
                    cost,
                    isPistolLegal,
                };
                armorByName.set(normalizeItemName(item.name), info);
                if (item.uuid) {
                    armorByUuid.set(item.uuid, info);
                }
                if (isPistolLegal) {
                    pistolLegalArmor.push(info);
                }
            }
        }
        else if (item.itemType === 'ability' && item.agentName) {
            const agentKey = normalizeAgentName(item.agentName);
            if (!abilitiesByAgent.has(agentKey)) {
                abilitiesByAgent.set(agentKey, {
                    agentName: item.agentName,
                    abilities: [],
                    purchasableAbilities: [],
                });
            }
            const agentData = abilitiesByAgent.get(agentKey);
            // Skip abilities without slot (passive abilities)
            if (!item.abilitySlot)
                continue;
            // Determine unit cost
            const unitCost = item.cost ?? item.costPerUse ?? 0;
            const maxCharges = item.maxCharges ?? 0;
            const isFree = unitCost === 0;
            // Purchasable: has cost, has charges, not ultimate (X)
            const isPurchasable = unitCost > 0 && maxCharges > 0 && item.abilitySlot !== 'X';
            const ability = {
                name: item.name,
                slot: item.abilitySlot,
                unitCost,
                maxCharges,
                isFree,
                isPurchasable,
            };
            agentData.abilities.push(ability);
            if (isPurchasable) {
                agentData.purchasableAbilities.push(ability);
            }
        }
    }
    initialized = true;
}
// Ensure loaded before any lookup
function ensureLoaded() {
    if (!initialized) {
        loadShopCosts();
    }
}
// --- Public Lookups ---
export function getWeaponCost(nameOrUuid) {
    ensureLoaded();
    // Try UUID first
    const byUuid = weaponsByUuid.get(nameOrUuid);
    if (byUuid)
        return byUuid.cost;
    // Try name
    const byName = weaponsByName.get(normalizeItemName(nameOrUuid));
    return byName?.cost;
}
export function getWeaponInfo(nameOrUuid) {
    ensureLoaded();
    const byUuid = weaponsByUuid.get(nameOrUuid);
    if (byUuid)
        return byUuid;
    return weaponsByName.get(normalizeItemName(nameOrUuid));
}
export function getArmorCost(nameOrUuid) {
    ensureLoaded();
    const byUuid = armorByUuid.get(nameOrUuid);
    if (byUuid)
        return byUuid.cost;
    const byName = armorByName.get(normalizeItemName(nameOrUuid));
    return byName?.cost;
}
export function getArmorInfo(nameOrUuid) {
    ensureLoaded();
    const byUuid = armorByUuid.get(nameOrUuid);
    if (byUuid)
        return byUuid;
    return armorByName.get(normalizeItemName(nameOrUuid));
}
export function getAgentAbilities(agentName) {
    ensureLoaded();
    return abilitiesByAgent.get(normalizeAgentName(agentName));
}
export function getPurchasableAbilities(agentName) {
    ensureLoaded();
    const agent = abilitiesByAgent.get(normalizeAgentName(agentName));
    return agent?.purchasableAbilities ?? [];
}
export function getPistolLegalWeapons() {
    ensureLoaded();
    return [...pistolLegalWeapons];
}
export function getPistolLegalArmor() {
    ensureLoaded();
    return [...pistolLegalArmor];
}
export function getAllAgentNames() {
    ensureLoaded();
    return Array.from(abilitiesByAgent.values()).map(a => a.agentName);
}
// --- Constants ---
export const PISTOL_ROUND_CREDITS = 800;
export const CLASSIC_COST = 0;
export const LIGHT_ARMOR_COST = 400;
export const HEAVY_ARMOR_COST = 1000;
export const REGEN_SHIELD_COST = 650;
