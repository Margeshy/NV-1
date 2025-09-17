const { SlashCommandBuilder } = require("@discordjs/builders");
const axios = require("axios");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("user")
        .setDescription(
            "Fetch detailed user info from Roblox (username or user ID)",
        )
        .addStringOption((opt) =>
            opt
                .setName("userid")
                .setDescription("Roblox username or user ID")
                .setRequired(true),
        ),
    async execute(interaction) {
        await interaction.deferReply();
        const input = interaction.options.getString("userid").trim();
        const safeJson = (obj) => {
            try {
                if (obj instanceof Error) return obj.stack || obj.message;
                return JSON.stringify(obj, null, 2);
            } catch {
                return String(obj);
            }
        };
        try {
            // 1) Lookup user (by numeric id or username)
            let userInfo;
            if (/^\d+$/.test(input)) {
                const res = await axios.get(
                    `https://users.roblox.com/v1/users/${input}`,
                );
                userInfo = res.data;
            } else {
                const res = await axios.post(
                    "https://users.roblox.com/v1/usernames/users",
                    {
                        usernames: [input],
                        excludeBannedUsers: true,
                    },
                );
                if (!res.data || !res.data.data || res.data.data.length === 0) {
                    return interaction.editReply(
                        `No Roblox user found for username \`${input}\`.`,
                    );
                }
                userInfo = res.data.data[0];
            }
            if (!userInfo || !userInfo.id) {
                return interaction.editReply(
                    "Failed to retrieve basic user info from Roblox.",
                );
            }
            const userId = userInfo.id;

            // 2) Thumbnail (headshot)
            let profileImageUrl = null;
            try {
                const thumbUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(userId)}&size=420x420&format=Png&isCircular=false`;
                const thumbRes = await axios.get(thumbUrl);
                if (
                    thumbRes.data &&
                    Array.isArray(thumbRes.data.data) &&
                    thumbRes.data.data[0]
                ) {
                    profileImageUrl = thumbRes.data.data[0].imageUrl || null;
                }
            } catch (thumbErr) {
                console.warn(
                    "Thumbnail fetch failed:",
                    thumbErr && thumbErr.message
                        ? thumbErr.message
                        : String(thumbErr),
                );
            }

            // 3) Games / Places (v2 then v1 fallback)
            let places = [];
            try {
                const gamesRes = await axios.get(
                    `https://games.roblox.com/v2/users/${userId}/games`,
                    { params: { limit: 10 } },
                );
                if (gamesRes.data && Array.isArray(gamesRes.data.data)) {
                    places = gamesRes.data.data.map((g) => {
                        const rootPlaceId =
                            g.rootPlaceId ||
                            (g.rootPlace && g.rootPlace.id) ||
                            null;
                        const placeId =
                            g.placeId || g.id || g.universeId || null;
                        const title =
                            g.name ||
                            g.title ||
                            (g.rootPlace && g.rootPlace.name) ||
                            "Untitled";
                        const primaryId = rootPlaceId || placeId || null;
                        const primaryUrl = primaryId
                            ? `https://www.roblox.com/games/${primaryId}`
                            : "https://www.roblox.com/games";
                        return {
                            name: title,
                            primaryId,
                            primaryUrl,
                            placeId,
                            raw: g,
                        };
                    });
                }
            } catch (gamesErr) {
                console.warn(
                    "v2 games fetch failed:",
                    gamesErr && gamesErr.message
                        ? gamesErr.message
                        : String(gamesErr),
                );
                // fallback to v1
                try {
                    const gamesRes = await axios.get(
                        `https://games.roblox.com/v1/users/${userId}/games`,
                        { params: { limit: 10 } },
                    );
                    if (gamesRes.data && Array.isArray(gamesRes.data.data)) {
                        places = gamesRes.data.data.map((g) => {
                            const rootPlaceId =
                                g.rootPlaceId ||
                                (g.rootPlace && g.rootPlace.id) ||
                                null;
                            const placeId =
                                g.placeId || g.id || g.universeId || null;
                            const title =
                                g.name ||
                                g.title ||
                                (g.rootPlace && g.rootPlace.name) ||
                                "Untitled";
                            const primaryId = rootPlaceId || placeId || null;
                            const primaryUrl = primaryId
                                ? `https://www.roblox.com/games/${primaryId}`
                                : "https://www.roblox.com/games";
                            return {
                                name: title,
                                primaryId,
                                primaryUrl,
                                placeId,
                                raw: g,
                            };
                        });
                    }
                } catch (gamesErr2) {
                    console.warn(
                        "v1 games fetch also failed:",
                        gamesErr2 && gamesErr2.message
                            ? gamesErr2.message
                            : String(gamesErr2),
                    );
                }
            }

            // ----------------------------------------------------------------
            // BADGES SECTION (updated)
            // - fetches latest badges with limit=10 (API requires minimum 10)
            // - fetches awarded dates via /badges/awarded-dates
            // - formats timestamps using Discord markdown <t:...> so viewers see local time
            // ----------------------------------------------------------------
            let badges = [];
            try {
                // Get up to 10 latest badges (descending)
                const badgesRes = await axios.get(
                    `https://badges.roblox.com/v1/users/${userId}/badges`,
                    {
                        params: { limit: 10, sortOrder: "Desc" },
                    },
                );
                if (badgesRes.data && Array.isArray(badgesRes.data.data)) {
                    // Map basic info (keep up to 10)
                    badges = badgesRes.data.data.slice(0, 10).map((b) => ({
                        id: b.id,
                        name: b.name || `Badge ${b.id}`,
                    }));
                }
                // If we have badge IDs, fetch awarded dates
                if (badges.length > 0) {
                    const badgeIdsParam = badges.map((b) => b.id).join(",");
                    const awardRes = await axios.get(
                        `https://badges.roblox.com/v1/users/${userId}/badges/awarded-dates`,
                        {
                            params: { badgeIds: badgeIdsParam },
                        },
                    );
                    // awardRes.data.data is expected to be an array of { badgeId, awardedDate }
                    const awardMap = new Map();
                    if (awardRes.data && Array.isArray(awardRes.data.data)) {
                        for (const entry of awardRes.data.data) {
                            // entry.badgeId (number) => entry.awardedDate (ISO string)
                            awardMap.set(
                                Number(entry.badgeId),
                                entry.awardedDate,
                            );
                        }
                    }
                    // Attach awardedDate to our badges list (as ISO), then compute Discord timestamps
                    badges = badges.map((b) => {
                        const iso = awardMap.get(Number(b.id)) || null;
                        if (iso) {
                            const unixSec = Math.floor(
                                new Date(iso).getTime() / 1000,
                            );
                            // Display full local time (F) and relative (R)
                            return {
                                ...b,
                                awardedDateISO: iso,
                                awardedDiscord: `<t:${unixSec}:t>`, // short time format
                                unixSec,
                            };
                        }
                        return {
                            ...b,
                            awardedDateISO: null,
                            awardedDiscord: null,
                            unixSec: null,
                        };
                    });
                }
            } catch (badgeErr) {
                console.warn(
                    "Badges fetch failed:",
                    badgeErr &&
                        (badgeErr.message ||
                            (badgeErr.response && badgeErr.response.status))
                        ? badgeErr.message || JSON.stringify(badgeErr.response)
                        : String(badgeErr),
                );
                badges = [];
            }

            // Utility to chunk lines into multiple fields so each field.value <= maxLen
            function chunkLinesToFields(
                titleBase,
                lines,
                maxLen = 1024,
                maxFields = 25,
            ) {
                const fields = [];
                if (!lines || lines.length === 0) return fields;
                let cur = [];
                let curLen = 0;
                for (const line of lines) {
                    const lineLen = line.length + 1; // for newline
                    if (curLen + lineLen > maxLen) {
                        fields.push({
                            name: `${titleBase} (${fields.length + 1})`,
                            value: cur.join(" "),
                            inline: false,
                        });
                        if (fields.length >= maxFields) return fields;
                        cur = [];
                        curLen = 0;
                    }
                    cur.push(line);
                    curLen += lineLen;
                }
                if (cur.length > 0 && fields.length < maxFields) {
                    fields.push({
                        name: `${titleBase} (${fields.length + 1})`,
                        value: cur.join(" "),
                        inline: false,
                    });
                }
                return fields;
            }

            // Build the profile field
            const profileField = {
                name: "Profile",
                value: [
                    `Username: ${userInfo.name || userInfo.username || input}`,
                    `Display Name: ${userInfo.displayName || userInfo.display_name || "—"}`,
                    `User ID: ${userId}`,
                ].join(" | "),
                inline: false,
            };

            // Add description field
            const description =
                userInfo.description || "No description available.";
            const descriptionField = {
                name: "Description",
                value: description,
                inline: false,
            };

            // Places lines
            const placeLines = places.map((p) => {
                const displayName =
                    p.name.length > 80 ? `${p.name.slice(0, 77)}...` : p.name;
                const rootLink = p.primaryUrl || "https://www.roblox.com/games";
                const placeIdPart = p.placeId
                    ? ` — [placeId](https://www.roblox.com/games/${p.placeId})`
                    : "";
                return `**[${displayName}](${rootLink})**${placeIdPart}`;
            });
            const placeFields = chunkLinesToFields("Places", placeLines, 1024);

            // Badges lines
            const badgeLines = badges.map((b) => {
                const namePart = b.id
                    ? `[${b.name}](https://www.roblox.com/badges/${b.id})`
                    : b.name;
                const datePart = b.awardedDiscord
                    ? ` - ${b.awardedDiscord}`
                    : "";
                return `${namePart}${datePart}`;
            });
            const badgeFields = chunkLinesToFields(
                "Latest Badges",
                badgeLines,
                1024,
            );

            // Links field
            const linksField = {
                name: "Links",
                value: [
                    `[Profile](https://www.roblox.com/users/${userId}/profile)`,
                    `[Inventory](https://www.roblox.com/users/${userId}/inventory#!/badges)`,
                    `[Favorites](https://www.roblox.com/users/${userId}/favorites)`,
                ].join(" | "),
                inline: false,
            };

            // Build fields with total-char tracking
            const fields = [];
            let totalChars = 0;
            const addFieldSafely = (fld) => {
                const nameLen = fld.name?.length || 0;
                const valueLen = fld.value?.length || 0;
                // Field name + value
                const fieldCount = nameLen + valueLen;
                if (totalChars + fieldCount > 6000) {
                    return false;
                }
                fields.push(fld);
                totalChars += fieldCount;
                return true;
            };

            // Add profile
            addFieldSafely(profileField);

            // Add description
            addFieldSafely(descriptionField);

            // Add places fields until limit
            for (const pf of placeFields) {
                if (!addFieldSafely(pf)) break;
            }

            // Add badges fields until limit
            for (const bf of badgeFields) {
                if (!addFieldSafely(bf)) break;
            }

            // Add links
            addFieldSafely(linksField);

            // Warn if exceeded or near limit
            if (totalChars > 6000) {
                fields.push({
                    name: "⚠️ Warning",
                    value: "The content exceeded Discord's embed character limit (6000 chars). Some content may have been omitted or truncated.",
                    inline: false,
                });
            }

            // Build embed
            const embed = {
                color: 0x0099ff,
                title: `${userInfo.name || userInfo.username || input}'s Profile`,
                url: `https://www.roblox.com/users/${userId}/profile`,
                thumbnail: profileImageUrl
                    ? { url: profileImageUrl }
                    : undefined,
                fields: fields,
                footer: { text: "Data from Roblox public web APIs" },
                timestamp: new Date().toISOString(),
            };

            // Reply with embed
            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error(
                "Error fetching user data:",
                safeJson(err && err.response ? err.response.data : err),
            );
            const msg =
                err &&
                err.response &&
                err.response.data &&
                err.response.data.message
                    ? `Failed to fetch user data. ${err.response.data.message}`
                    : `Failed to fetch user data: ${err && err.message ? err.message : "Unknown error"}`;
            await interaction.editReply(msg);
        }
    },
};
