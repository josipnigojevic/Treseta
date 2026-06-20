CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  username text NOT NULL,
  username_key text NOT NULL UNIQUE,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  solo_mmr integer NOT NULL DEFAULT 1000 CHECK (solo_mmr >= 100),
  seres_mmr integer NOT NULL DEFAULT 1000 CHECK (seres_mmr >= 100),
  ranked_wins integer NOT NULL DEFAULT 0 CHECK (ranked_wins >= 0),
  ranked_losses integer NOT NULL DEFAULT 0 CHECK (ranked_losses >= 0),
  casual_wins integer NOT NULL DEFAULT 0 CHECK (casual_wins >= 0),
  casual_losses integer NOT NULL DEFAULT 0 CHECK (casual_losses >= 0),
  seres_ranked_wins integer NOT NULL DEFAULT 0 CHECK (seres_ranked_wins >= 0),
  seres_ranked_losses integer NOT NULL DEFAULT 0 CHECK (seres_ranked_losses >= 0),
  seres_casual_wins integer NOT NULL DEFAULT 0 CHECK (seres_casual_wins >= 0),
  seres_casual_losses integer NOT NULL DEFAULT 0 CHECK (seres_casual_losses >= 0),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  last_login_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE duos (
  id uuid PRIMARY KEY,
  account_low_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  account_high_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  mmr integer NOT NULL DEFAULT 1000 CHECK (mmr >= 100),
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses integer NOT NULL DEFAULT 0 CHECK (losses >= 0),
  games integer NOT NULL DEFAULT 0 CHECK (games >= 0 AND games = wins + losses),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT duos_canonical_pair CHECK (account_low_id::text < account_high_id::text),
  CONSTRAINT duos_unique_pair UNIQUE (account_low_id, account_high_id)
);

CREATE TABLE matches (
  id text PRIMARY KEY,
  room_code text,
  mode text NOT NULL DEFAULT 'classic'
    CHECK (mode IN ('classic', 'seres_u_manje')),
  ranking_key text,
  ranked boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT NOW(),
  winner_team smallint CHECK (winner_team IN (0, 1)),
  team_scores jsonb,
  loser_seat smallint CHECK (loser_seat IS NULL OR loser_seat >= 0),
  player_scores_thirds jsonb,
  standings jsonb,
  hand_count integer NOT NULL CHECK (hand_count >= 1),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT matches_mode_result CHECK (
    (mode = 'classic' AND winner_team IS NOT NULL AND team_scores IS NOT NULL
      AND loser_seat IS NULL AND player_scores_thirds IS NULL AND standings IS NULL)
    OR
    (mode = 'seres_u_manje' AND winner_team IS NULL AND team_scores IS NULL
      AND loser_seat IS NOT NULL AND player_scores_thirds IS NOT NULL
      AND standings IS NOT NULL)
  )
);

CREATE TABLE match_players (
  match_id text NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  seat smallint NOT NULL CHECK (seat >= 0),
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  username text NOT NULL,
  nickname text NOT NULL,
  team smallint CHECK (team IN (0, 1)),
  won boolean NOT NULL,
  rank smallint CHECK (rank IS NULL OR rank >= 1),
  score_thirds integer,
  solo_before integer CHECK (solo_before IS NULL OR solo_before >= 100),
  solo_after integer CHECK (solo_after IS NULL OR solo_after >= 100),
  solo_delta integer,
  duo_before integer CHECK (duo_before IS NULL OR duo_before >= 100),
  duo_after integer CHECK (duo_after IS NULL OR duo_after >= 100),
  duo_delta integer,
  partner_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  seres_before integer CHECK (seres_before IS NULL OR seres_before >= 100),
  seres_after integer CHECK (seres_after IS NULL OR seres_after >= 100),
  seres_delta integer,
  PRIMARY KEY (match_id, seat)
);

CREATE INDEX matches_completed_at_idx ON matches (completed_at DESC);
CREATE INDEX match_players_account_history_idx ON match_players (account_id, match_id)
  WHERE account_id IS NOT NULL;
CREATE INDEX duos_high_account_idx ON duos (account_high_id);
