/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { useForceUpdater } from "@utils/react";
import { Channel } from "@vencord/discord-types";

const DS_KEY = "FriendGroups_data";

export interface FriendGroup {
    name: string;
    color: string;
    members: string[];
    collapsed?: boolean;
}

export type GroupMap = Record<string, FriendGroup>;

let cachedGroups: GroupMap = {};
let forceUpdateDms: (() => void) | undefined;

export async function loadGroups(): Promise<GroupMap> {
    cachedGroups = (await DataStore.get<GroupMap>(DS_KEY)) ?? {};
    return cachedGroups;
}

export async function saveGroups(groups: GroupMap): Promise<void> {
    cachedGroups = groups;
    await DataStore.set(DS_KEY, groups);
    forceUpdateDms?.();
}

export function init() {
    loadGroups().then(() => forceUpdateDms?.());
}

export function useFriendGroups() {
    forceUpdateDms = useForceUpdater();
}

export function getGroups(): GroupMap {
    return cachedGroups;
}

export function getGroupArray(): Array<FriendGroup & { key: string; }> {
    return Object.entries(cachedGroups).map(([key, group]) => ({ ...group, key }));
}

export function getGroupByIndex(index: number): [string, FriendGroup] | undefined {
    return Object.entries(cachedGroups)[index];
}

export function categoryLen(): number {
    return Object.keys(cachedGroups).length;
}

export function getChannelIdForUser(userId: string, channels: Record<string, Channel>): string | null {
    for (const [channelId, channel] of Object.entries(channels)) {
        if (channel.type === 1 && (channel as any).recipients?.includes(userId)) {
            return channelId;
        }
    }
    return null;
}

/** Get the channel IDs for a group's members, filtered to only those with open DMs. */
export function getGroupChannelIds(group: FriendGroup, channels: Record<string, Channel>): string[] {
    return group.members
        .map(userId => getChannelIdForUser(userId, channels))
        .filter((id): id is string => id !== null);
}

/** Returns section row counts for each friend group category. */
export function getSections(channels: Record<string, Channel>): number[] {
    return Object.values(cachedGroups).map(group => {
        const channelIds = getGroupChannelIds(group, channels);
        // At least 1 row so the header renders even with no DMs
        return channelIds.length || 1;
    });
}

export function isChannelInGroup(channelId: string, channels: Record<string, Channel>): boolean {
    for (const group of Object.values(cachedGroups)) {
        const groupChannelIds = getGroupChannelIds(group, channels);
        if (groupChannelIds.includes(channelId)) return true;
    }
    return false;
}

export function getAllGroupChannelIds(channels: Record<string, Channel>): string[] {
    const ids: string[] = [];
    for (const group of Object.values(cachedGroups)) {
        ids.push(...getGroupChannelIds(group, channels));
    }
    return ids;
}

export function collapseGroup(key: string, value: boolean) {
    const group = cachedGroups[key];
    if (group) {
        group.collapsed = value;
        forceUpdateDms?.();
    }
}

export function toggleMember(userId: string, groupKey: string) {
    const group = cachedGroups[groupKey];
    if (!group) return;

    group.members = group.members.includes(userId)
        ? group.members.filter(id => id !== userId)
        : [...group.members, userId];

    saveGroups(cachedGroups);
}

export async function createGroup(name: string, color: string): Promise<boolean> {
    const key = name.toLowerCase().replace(/\s+/g, "_");
    if (cachedGroups[key]) return false;

    cachedGroups[key] = { name, color, members: [] };
    await saveGroups(cachedGroups);
    return true;
}

export function isUserInAnyGroup(userId: string): boolean {
    return Object.values(cachedGroups).some(g => g.members.includes(userId));
}

export function getUserGroups(userId: string): string[] {
    return Object.entries(cachedGroups)
        .filter(([_, group]) => group.members.includes(userId))
        .map(([key]) => key);
}

function reorderGroups(newOrder: string[]) {
    const reordered: GroupMap = {};
    for (const key of newOrder) {
        if (cachedGroups[key]) {
            reordered[key] = cachedGroups[key];
        }
    }
    saveGroups(reordered);
}

export function moveGroupUp(key: string): void {
    const keys = Object.keys(cachedGroups);
    const idx = keys.indexOf(key);
    if (idx <= 0) return;

    [keys[idx - 1], keys[idx]] = [keys[idx], keys[idx - 1]];
    reorderGroups(keys);
}

export function moveGroupDown(key: string): void {
    const keys = Object.keys(cachedGroups);
    const idx = keys.indexOf(key);
    if (idx === -1 || idx >= keys.length - 1) return;

    [keys[idx], keys[idx + 1]] = [keys[idx + 1], keys[idx]];
    reorderGroups(keys);
}

export function deleteGroup(groupKey: string): void {
    const keys = Object.keys(cachedGroups).filter(k => k !== groupKey);
    reorderGroups(keys);
}
