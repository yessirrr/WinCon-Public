/**
 * Shop Cost Registry - Single source of truth for VALORANT item costs.
 * Loads from data/valorant_shop_costs.json and provides lookup maps.
 */
export interface ShopItem {
    itemType: 'weapon' | 'armor' | 'gear' | 'ability';
    name: string;
    uuid?: string;
    cost?: number;
    costPerUse?: number;
    category?: string;
    agentName?: string;
    abilitySlot?: 'C' | 'Q' | 'E' | 'X';
    abilityType?: 'basic' | 'signature';
    maxCharges?: number;
    costNote?: string;
}
export interface AgentAbility {
    name: string;
    slot: 'C' | 'Q' | 'E' | 'X';
    unitCost: number;
    maxCharges: number;
    isFree: boolean;
    isPurchasable: boolean;
}
export interface AgentAbilities {
    agentName: string;
    abilities: AgentAbility[];
    purchasableAbilities: AgentAbility[];
}
export interface WeaponInfo {
    name: string;
    uuid?: string;
    cost: number;
    category: string;
    isPistolLegal: boolean;
}
export interface ArmorInfo {
    name: string;
    uuid?: string;
    cost: number;
    isPistolLegal: boolean;
}
export declare function loadShopCosts(): void;
export declare function getWeaponCost(nameOrUuid: string): number | undefined;
export declare function getWeaponInfo(nameOrUuid: string): WeaponInfo | undefined;
export declare function getArmorCost(nameOrUuid: string): number | undefined;
export declare function getArmorInfo(nameOrUuid: string): ArmorInfo | undefined;
export declare function getAgentAbilities(agentName: string): AgentAbilities | undefined;
export declare function getPurchasableAbilities(agentName: string): AgentAbility[];
export declare function getPistolLegalWeapons(): WeaponInfo[];
export declare function getPistolLegalArmor(): ArmorInfo[];
export declare function getAllAgentNames(): string[];
export declare const PISTOL_ROUND_CREDITS = 800;
export declare const CLASSIC_COST = 0;
export declare const LIGHT_ARMOR_COST = 400;
export declare const HEAVY_ARMOR_COST = 1000;
export declare const REGEN_SHIELD_COST = 650;
