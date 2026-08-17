/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import ErrorBoundary from "@components/ErrorBoundary";
import { classes } from "@utils/misc";
import definePlugin, { StartAt } from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { findCssClassesLazy } from "@webpack";
import { Clickable, ContextMenuApi, FluxDispatcher, Forms, Menu, Modal, openModal, React, TextInput } from "@webpack/common";
import { RenderModalProps } from "@vencord/discord-types";

import {
    categoryLen,
    collapseGroup,
    createGroup,
    getAllGroupChannelIds as getAllGroupChannelIdsFromData,
    getGroupByIndex,
    getGroupChannelIds,
    getGroups,
    getSections,
    getUserGroups,
    init,
    saveGroups,
    toggleMember,
    useFriendGroups
} from "./data";

const headerClasses = findCssClassesLazy("privateChannelsHeaderContainer", "headerText");

interface ChannelComponentProps {
    children: React.ReactNode;
    channel: Channel;
    selected: boolean;
}

function userToChannelIndex(sectionIndex: number, channelIndex: number, channels: Record<string, Channel>): { channelId: string | null; groupKey: string | null; } {
    const groupEntry = getGroupByIndex(sectionIndex - 1);
    if (!groupEntry) return { channelId: null, groupKey: null };

    const [groupKey, group] = groupEntry;
    const channelIds = getGroupChannelIds(group, channels);
    const channelId = channelIds[channelIndex] ?? null;
    return { channelId, groupKey };
}

function openCreateGroupModal() {
    openModal((modalProps: RenderModalProps) => <CreateGroupModal modalProps={modalProps} />);
}

function CreateGroupModal({ modalProps }: { modalProps: RenderModalProps; }) {
    const [name, setName] = React.useState("");
    const [color, setColor] = React.useState("#5865f2");

    return (
        <Modal
            {...modalProps}
            title="Create Friend Group"
            actions={[
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: modalProps.onClose
                },
                {
                    text: "Create",
                    variant: "primary",
                    onClick: async () => {
                        if (name.trim()) {
                            await createGroup(name.trim(), color);
                        }
                        modalProps.onClose();
                    },
                    disabled: !name.trim()
                }
            ]}
        >
            <Forms.FormTitle tag="h5">Group Name</Forms.FormTitle>
            <TextInput
                value={name}
                onChange={setName}
                placeholder="e.g., Minecraft"
                autoFocus
            />
            <Forms.FormTitle tag="h5">Color</Forms.FormTitle>
            <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                style={{ width: "100%", height: "40px", border: "none", cursor: "pointer" }}
            />
        </Modal>
    );
}

const UserContext: NavContextMenuPatchCallback = (children, props) => {
    const user = props.user;
    if (!user?.id) return;

    const userId = user.id;
    const groups = getGroups();
    const userGroupKeys = getUserGroups(userId);

    const container = findGroupChildrenByChildId("close-dm", children);
    if (!container) return;

    const idx = container.findIndex(c => c?.props?.id === "close-dm");

    const groupItems = Object.entries(groups).map(([key, group]) => (
        <Menu.MenuItem
            key={`vc-fg-${key}`}
            id={`vc-fg-${key}`}
            label={`${userGroupKeys.includes(key) ? "✓ " : ""}${group.name}`}
            action={() => toggleMember(userId, key)}
        />
    ));

    container.splice(idx, 0,
        <Menu.MenuItem
            key="vc-friend-groups"
            id="vc-friend-groups"
            label="Friend Groups"
        >
            {groupItems.length > 0 ? groupItems : (
                <Menu.MenuItem
                    key="vc-fg-empty"
                    id="vc-fg-empty"
                    label="No groups yet"
                    disabled
                />
            )}
            <Menu.MenuSeparator key="vc-fg-sep" />
            <Menu.MenuItem
                key="vc-fg-create"
                id="vc-fg-create"
                label="Create New Group..."
                action={openCreateGroupModal}
            />
        </Menu.MenuItem>
    );
};

export default definePlugin({
    name: "FriendGroups",
    authors: [{ name: "CipherOS", id: 0n }],
    description: "Organize your friends into custom groups visible as collapsible categories in the DM sidebar",
    tags: ["Friends", "Organisation"],

    patches: [
        {
            find: '"dm-quick-launcher"===',
            replacement: [
                {
                    // Inject friend group sections into the sections array
                    match: /(?<=renderRow:this\.renderRow,)sections:\[.+?1\)]/,
                    replace: "...$self.makeProps(this,{$&})"
                },
                // Override renderRow to render our group channels
                {
                    match: /renderRow(?:",|=)(\i)=>{(?<=renderDM(?:",|=).+?(\i\.\i),\{channel:.+?)/,
                    replace: "$&if($self.isChannelIndex($1.section,$1.row))return $self.renderChannel($1.section,$1.row,$2)();"
                },
                // Override renderSection to render our category headers
                {
                    match: /renderSection(?:",|=)(\i)=>{/,
                    replace: "$&if($self.isCategoryIndex($1.section))return $self.renderCategory($1);"
                },
                // Fix row height to account for our sections
                {
                    match: /(\.startsWith\("section-divider"\).+?return 1===)(\i)/,
                    replace: "$1($2-$self.categoryLen())"
                },
                // Fix getRowHeight to return 0 for hidden (collapsed) group channels
                {
                    match: /getRowHeight(?:",|=)\((\i),(\i)\)=>{/,
                    replace: "$&if($self.isChannelHidden($1,$2))return 0;"
                },
                // Fix scrollToChannel to account for our extra sections
                {
                    match: /(?<=scrollTo\(\{to:\i\}\):\(\i\+=)(\d+)\*\(.+?(?=,)/,
                    replace: "$self.getScrollOffset(arguments[0],$1,this?.props?.padding,this?.state?.preRenderedChildren,$&)"
                },
                {
                    match: /(scrollToChannel\(\i\){.{1,300})(this\.props\.privateChannelIds)/,
                    replace: "$1[...$2,...$self.getAllGroupChannelIds()]"
                }
            ]
        },

        // Force update on connection open
        {
            find: ".FRIENDS},\"friends\"",
            replacement: {
                match: /let{showLibrary:\i,/,
                replace: "$self.useFriendGroups();$&"
            }
        },

        // Fix Alt Up/Down navigation to include group channels
        {
            find: ".APPLICATION_STORE&&",
            replacement: {
                match: /(?<=\i=__OVERLAY__\?\i:\[\.\.\.\i\(\),\.\.\.)\i/,
                replace: "$self.getAllGroupChannelIds().concat($&)"
            }
        },

        // Fix alt+shift+up/down navigation
        {
            find: "=()=>!1,ensureChatIsVisible:",
            replacement: {
                match: /(?<=\i===\i\.ME\?)\i\.\i\.getPrivateChannelIds\(\)/,
                replace: "$self.getAllGroupChannelIds().concat($&)"
            }
        }
    ],

    sections: null as number[] | null,
    instance: null as any,
    channelsSnapshot: {} as Record<string, Channel>,

    startAt: StartAt.WebpackReady,
    start: init,
    flux: {
        CONNECTION_OPEN: init
    },

    useFriendGroups,
    categoryLen,
    makeProps(inst: any, { sections }: { sections: number[]; }) {
        this.instance = inst;
        this.sections = sections;
        this.channelsSnapshot = inst?.props?.channels ?? {};

        const groupChannelIds = getAllGroupChannelIdsFromData(this.channelsSnapshot);

        if (inst?.props?.privateChannelIds?.length > 0) {
            inst.props.privateChannelIds = inst.props.privateChannelIds.filter(
                (id: string) => !groupChannelIds.includes(id)
            );
            this.sections[0] = Math.max(inst.props.privateChannelIds.length, 0);
        }

        const groupSections = getSections(this.channelsSnapshot);
        this.sections.splice(1, 0, ...groupSections);

        if (inst?.props?.privateChannelIds?.length === 0 && groupSections.every(s => s === 0)) {
            this.sections[this.sections.length - 1] = 0;
        }

        return {
            sections: this.sections,
            chunkSize: this.getChunkSize()
        };
    },

    getChunkSize() {
        const sections = this.getSectionsForChunkSize();
        const sectionHeaderSizePx = sections.length * 40;
        return (sectionHeaderSizePx + sections.reduce((acc, v) => acc + v * 44, 0) + 256) * 1.5;
    },

    getSectionsForChunkSize(): number[] {
        return getSections(this.channelsSnapshot);
    },

    getAllGroupChannelIds(): string[] {
        return getAllGroupChannelIdsFromData(this.channelsSnapshot);
    },

    isCategoryIndex(sectionIndex: number): boolean {
        return this.sections != null && sectionIndex > 0 && sectionIndex < this.sections.length - 1;
    },

    isChannelIndex(sectionIndex: number, channelIndex: number): boolean {
        if (!this.isCategoryIndex(sectionIndex)) return false;

        const groupEntry = getGroupByIndex(sectionIndex - 1);
        if (!groupEntry) return false;

        const [, group] = groupEntry;
        const channelIds = getGroupChannelIds(group, this.channelsSnapshot);
        return channelIds.length === 0 || channelIds[channelIndex] != null;
    },

    isChannelHidden(categoryIndex: number, channelIndex: number): boolean {
        if (categoryIndex === 0) return false;
        if (!this.isChannelIndex(categoryIndex, channelIndex)) return false;

        const groupEntry = getGroupByIndex(categoryIndex - 1);
        if (!groupEntry) return false;

        const [, group] = groupEntry;
        if (!group.collapsed) return false;

        const channelIds = getGroupChannelIds(group, this.channelsSnapshot);
        const channelId = channelIds[channelIndex];
        return channelId != null && this.instance?.props?.selectedChannelId !== channelId;
    },

    getScrollOffset(channelId: string, rowHeight: number, padding: number, preRenderedChildren: number, originalOffset: number) {
        const allGroupChannels = this.getAllGroupChannelIds();
        const idx = allGroupChannels.indexOf(channelId);

        if (idx !== -1) {
            return rowHeight * (idx + preRenderedChildren) + padding;
        }

        return (
            (rowHeight + padding) * 2
            + rowHeight * allGroupChannels.length
            + originalOffset
        );
    },

    renderCategory: ErrorBoundary.wrap(({ section }: { section: number; }) => {
        const groupEntry = getGroupByIndex(section - 1);
        if (!groupEntry) return null;

        const [groupKey, group] = groupEntry;
        const colorNum = parseInt(group.color.replace("#", ""), 16);

        return (
            <Clickable
                onClick={() => collapseGroup(groupKey, !group.collapsed)}
                onContextMenu={e => {
                    ContextMenuApi.openContextMenu(e, () => (
                        <Menu.Menu
                            navId="vc-friendgroups-header-menu"
                            onClose={() => FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
                            color="danger"
                            aria-label="Friend Groups Menu"
                        >
                            <Menu.MenuItem
                                id="vc-fg-delete-group"
                                color="danger"
                                label="Delete Group"
                                action={async () => {
                                    const groups = getGroups();
                                    delete groups[groupKey];
                                    await saveGroups(groups);
                                }}
                            />
                        </Menu.Menu>
                    ));
                }}
            >
                <h2
                    className={classes(headerClasses.privateChannelsHeaderContainer, "vc-friendgroups-section-container", group.collapsed ? "vc-friendgroups-collapsed" : "")}
                    style={{ color: `#${colorNum.toString(16).padStart(6, "0")}` }}
                >
                    <span className={headerClasses.headerText}>
                        {group.name}
                    </span>
                    <svg className="vc-friendgroups-collapse-icon" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M9.3 5.3a1 1 0 0 0 0 1.4l5.29 5.3-5.3 5.3a1 1 0 1 0 1.42 1.4l6-6a1 1 0 0 0 0-1.4l-6-6a1 1 0 0 0-1.42 0Z"></path>
                    </svg>
                </h2>
            </Clickable>
        );
    }, { noop: true }),

    renderChannel(sectionIndex: number, index: number, ChannelComponent: React.ComponentType<ChannelComponentProps>) {
        return ErrorBoundary.wrap(() => {
            const channels = this.channelsSnapshot;
            const { channelId, groupKey } = userToChannelIndex(sectionIndex, index, channels);

            if (!channelId || !groupKey) return null;
            if (this.isChannelHidden(sectionIndex, index)) return null;

            const channel = channels[channelId];
            if (!channel) return null;

            return (
                <ChannelComponent
                    channel={channel}
                    selected={this.instance?.props?.selectedChannelId === channelId}
                >
                    {channelId}
                </ChannelComponent>
            );
        }, { noop: true });
    },

    contextMenus: {
        "user-context": UserContext
    },

    stop() {
        this.instance = null;
        this.channelsSnapshot = {};
        this.sections = null;
    }
});
