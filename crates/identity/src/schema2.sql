-- Additive account preferences; schema.sql remains the frozen v1 baseline.
CREATE TABLE aether_identity.preferences (
    tenant text NOT NULL, user_id text NOT NULL,
    theme text NOT NULL DEFAULT 'dark' CHECK(theme IN ('dark','light','system')),
    theme_id text NOT NULL DEFAULT '' CHECK(char_length(theme_id)<=64),
    avatar text NOT NULL DEFAULT '' CHECK(octet_length(avatar)<=350000),
    PRIMARY KEY(tenant,user_id),
    FOREIGN KEY(tenant,user_id) REFERENCES aether_identity.users(tenant,id) ON DELETE CASCADE
);
