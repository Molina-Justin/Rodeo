
export interface paths {
    "/api/v1/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["live_api_v1_health_live_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ready_api_v1_health_ready_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["capabilities_api_v1_capabilities_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/backups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["backup_status_api_v1_system_backups_get"];
        put?: never;
        post: operations["backup_now_api_v1_system_backups_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/backups/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["restore_backup_api_v1_system_backups_restore_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/backups/files": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["backup_files_api_v1_system_backups_files_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/backups/files/{filename}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["remove_backup_api_v1_system_backups_files__filename__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/settings/prompt-templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["prompt_templates_api_v1_settings_prompt_templates_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/settings/prompt-templates/{template_key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["save_prompt_template_api_v1_settings_prompt_templates__template_key__put"];
        post?: never;
        delete: operations["reset_saved_prompt_template_api_v1_settings_prompt_templates__template_key__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/settings/interview-goals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["interview_goals_api_v1_settings_interview_goals_get"];
        put: operations["save_interview_goals_api_v1_settings_interview_goals_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["export_data_api_v1_system_export_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/clear": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["clear_data_api_v1_system_clear_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/problems": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["problems_api_v1_problems_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/problems/{problem_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["problem_api_v1_problems__problem_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attempts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["read_attempts_api_v1_attempts_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/problems/{problem_id}/attempts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["read_problem_attempts_api_v1_problems__problem_id__attempts_get"];
        put?: never;
        post: operations["create_problem_attempt_api_v1_problems__problem_id__attempts_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attempts/{attempt_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["read_attempt_api_v1_attempts__attempt_id__get"];
        put?: never;
        post?: never;
        delete: operations["remove_attempt_api_v1_attempts__attempt_id__delete"];
        options?: never;
        head?: never;
        patch: operations["patch_attempt_api_v1_attempts__attempt_id__patch"];
        trace?: never;
    };
    "/api/v1/attempts/{attempt_id}/recording": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["remove_attempt_recording_api_v1_attempts__attempt_id__recording_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["refresh_api_v1_catalog_refresh_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dashboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["read_dashboard_api_v1_dashboard_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/review-queue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["review_queue_api_v1_review_queue_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/jobs/{job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["read_api_v1_jobs__job_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/practice-sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["start_api_v1_practice_sessions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/practice-sessions/current": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["current_api_v1_practice_sessions_current_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/practice-sessions/{session_id}/pause": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["pause_api_v1_practice_sessions__session_id__pause_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/practice-sessions/{session_id}/resume": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["resume_api_v1_practice_sessions__session_id__resume_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/practice-sessions/{session_id}/stop": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["stop_api_v1_practice_sessions__session_id__stop_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/practice-sessions/{session_id}/finalize": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["finalize_api_v1_practice_sessions__session_id__finalize_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/practice-sessions/{session_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["discard_api_v1_practice_sessions__session_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recordings/{recording_id}/content": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["content_api_v1_recordings__recording_id__content_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attempts/{attempt_id}/transcription": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["read_api_v1_attempts__attempt_id__transcription_get"];
        put?: never;
        post: operations["create_api_v1_attempts__attempt_id__transcription_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["correct_api_v1_attempts__attempt_id__transcription_patch"];
        trace?: never;
    };
    "/api/v1/attempts/{attempt_id}/transcription/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["retry_api_v1_attempts__attempt_id__transcription_retry_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ActivityDay: {
            key: string;
            minutes: number;
            problem_count: number;
            activity_level: number;
        };
        AttemptBlocker: "none" | "pattern" | "edge-cases" | "complexity" | "implementation" | "debugging" | "time";
        AttemptCreate: {
            completed_at: string;
            duration_seconds: number;
            outcome: components["schemas"]["AttemptOutcome"];
            effort: components["schemas"]["AttemptEffort"];
            blocker: components["schemas"]["AttemptBlocker"];
            notes: string;
        };
        AttemptEffort: "light" | "moderate" | "heavy" | "brutal";
        AttemptListResponse: {
            items: components["schemas"]["AttemptResponse"][];
            total: number;
            offset: number;
            limit: number;
        };
        AttemptOutcome: "optimal" | "hint" | "solution" | "failed";
        AttemptResponse: {
            id: string;
            problem_id: number;
            practice_session_id: string | null;
            completed_at: string;
            duration_seconds: number;
            problem_difficulty_at_attempt: components["schemas"]["Difficulty"] | null;
            target_minutes_at_attempt?: number | null;
            outcome: components["schemas"]["AttemptOutcome"];
            effort: components["schemas"]["AttemptEffort"];
            blocker: components["schemas"]["AttemptBlocker"];
            notes: string;
            recording_id: string | null;
            transcription_id: string | null;
            transcription_status: components["schemas"]["TranscriptionStatus"] | null;
            has_audio: boolean;
            has_transcript: boolean;
            created_at: string;
            updated_at: string;
        };
        AttemptUpdate: {
            completed_at?: string | null;
            duration_seconds?: number | null;
            outcome?: components["schemas"]["AttemptOutcome"] | null;
            effort?: components["schemas"]["AttemptEffort"] | null;
            blocker?: components["schemas"]["AttemptBlocker"] | null;
            notes?: string | null;
        };
        BackupFile: {
            filename: string;
            size_bytes: number;
            created_at: string;
            attempt_count?: number | null;
            solved_count?: number | null;
        };
        BackupFileListResponse: {
            location: string;
            recording_count: number;
            files: components["schemas"]["BackupFile"][];
        };
        BackupStatusResponse: {
            enabled: boolean;
            last_backup_at: string | null;
            next_backup_at: string | null;
            last_backup_filename: string | null;
            snapshot_count: number;
            recordings_included: boolean;
            location: string;
        };
        Body_stop_api_v1_practice_sessions__session_id__stop_post: {
            audio?: string | null;
        };
        CapabilitiesResponse: {
            transcription: components["schemas"]["TranscriptionCapability"];
        };
        CatalogSyncResponse: {
            id: string;
            status: components["schemas"]["CatalogSyncStatus"];
            source: string;
            started_at: string;
            completed_at: string | null;
            added_count: number;
            updated_count: number;
            deactivated_count: number;
            error_code: string | null;
            error_message: string | null;
        };
        CatalogSyncStatus: "running" | "completed" | "failed";
        ClearResponse: {
            attempts_deleted: number;
            practice_sessions_deleted: number;
            recordings_deleted: number;
            settings_deleted: number;
            cleared_at: string;
        };
        ConsistencyResponse: {
            days: components["schemas"]["ActivityDay"][];
            minutes: number;
            problem_count: number;
            streak: number;
            best_streak: number;
        };
        DashboardRange: 30 | 60 | 90 | 180;
        DashboardResponse: {
            attempt_count: number;
            solved_count: number;
            logged_today: number;
            mastery_score: number;
            readiness_score: number;
            due_count: number;
            consistency: components["schemas"]["ConsistencyResponse"];
            focuses: components["schemas"]["TopicFocusResponse"][];
            review_queue: components["schemas"]["ReviewQueueItem"][];
        };
        Difficulty: "easy" | "medium" | "hard";
        ExportAttempt: {
            id: string;
            problem_id: number;
            problem_title: string;
            problem_slug: string;
            completed_at: string;
            duration_seconds: number;
            outcome: components["schemas"]["AttemptOutcome"];
            effort: components["schemas"]["AttemptEffort"];
            blocker: components["schemas"]["AttemptBlocker"];
            notes: string;
            transcript: string | null;
            created_at: string;
        };
        ExportResponse: {
            generated_at: string;
            attempts: components["schemas"]["ExportAttempt"][];
            review_state: components["schemas"]["ExportReviewState"][];
            prompt_templates: components["schemas"]["PromptTemplatesResponse"];
            interview_goals: components["schemas"]["InterviewGoalsResponse"];
        };
        ExportReviewState: {
            problem_id: number;
            problem_title: string;
            status: components["schemas"]["ProblemStatus"];
            attempt_count: number;
            best_duration_seconds: number | null;
            interval_days: number;
            lapses: number;
            confidence: number;
            due_at: string | null;
        };
        FinalizePracticeSessionResponse: {
            session: components["schemas"]["PracticeSessionResponse"];
            attempt: components["schemas"]["AttemptResponse"];
            created: boolean;
        };
        HTTPValidationError: {
            detail?: components["schemas"]["ValidationError"][];
        };
        HealthResponse: {
            status: "ok";
        };
        InterviewGoalsResponse: {
            target_role: string;
            target_date: string;
            years_experience: number | null;
        };
        InterviewGoalsUpdate: {
            target_role: string;
            target_date: string;
            years_experience?: number | null;
        };
        JobResponse: {
            id: string;
            kind: string;
            status: components["schemas"]["JobStatus"];
            attempts: number;
            max_attempts: number;
            available_at: string;
            lease_expires_at: string | null;
            error_code: string | null;
            error_message: string | null;
            completed_at: string | null;
            created_at: string;
            updated_at: string;
        };
        JobStatus: "queued" | "processing" | "completed" | "failed" | "cancelled";
        LatestAttemptSummary: {
            id: string;
            completed_at: string;
            duration_seconds: number;
            outcome: components["schemas"]["AttemptOutcome"];
            effort: components["schemas"]["AttemptEffort"];
            blocker: components["schemas"]["AttemptBlocker"];
        };
        PracticeSessionCreate: {
            problem_id: number;
        };
        PracticeSessionFinalize: {
            duration_seconds?: number | null;
            outcome: components["schemas"]["AttemptOutcome"];
            effort: components["schemas"]["AttemptEffort"];
            blocker: components["schemas"]["AttemptBlocker"];
            notes: string;
        };
        PracticeSessionResponse: {
            id: string;
            problem_id: number;
            status: components["schemas"]["PracticeSessionStatus"];
            started_at: string;
            running_since: string | null;
            paused_at: string | null;
            stopped_at: string | null;
            finalized_at: string | null;
            active_duration_ms: number;
            attempt_id: string | null;
            recording: components["schemas"]["RecordingResponse"] | null;
            created_at: string;
            updated_at: string;
        };
        PracticeSessionStatus: "active" | "paused" | "awaiting_details" | "finalized" | "discarded";
        ProblemAccess: "all" | "free" | "premium";
        ProblemDetail: {
            id: number;
            title: string;
            slug: string;
            difficulty: components["schemas"]["Difficulty"];
            premium: boolean;
            acceptance: number;
            active: boolean;
            topics: string[];
            status: components["schemas"]["ProblemStatus"];
            attempt_count: number;
            last_attempt: components["schemas"]["LatestAttemptSummary"] | null;
            best_duration_seconds: number | null;
            due_at: string | null;
            has_notes: boolean;
            has_audio: boolean;
            has_transcript: boolean;
            catalog_updated_at: string | null;
            created_at: string;
            updated_at: string;
        };
        ProblemListItem: {
            id: number;
            title: string;
            slug: string;
            difficulty: components["schemas"]["Difficulty"];
            premium: boolean;
            acceptance: number;
            active: boolean;
            topics: string[];
            status: components["schemas"]["ProblemStatus"];
            attempt_count: number;
            last_attempt: components["schemas"]["LatestAttemptSummary"] | null;
            best_duration_seconds: number | null;
            due_at: string | null;
            has_notes: boolean;
            has_audio: boolean;
            has_transcript: boolean;
        };
        ProblemPage: {
            items: components["schemas"]["ProblemListItem"][];
            page: number;
            page_size: number;
            total: number;
            page_count: number;
        };
        ProblemSort: "id-asc" | "id-desc" | "title-asc" | "title-desc" | "difficulty-asc" | "difficulty-desc" | "acceptance-asc" | "acceptance-desc";
        ProblemStatus: "not-started" | "solved" | "review" | "struggling";
        PromptTemplateUpdate: {
            template: string;
        };
        PromptTemplatesResponse: {
            session_template: string;
            review_template: string;
        };
        ReadinessResponse: {
            status: "ready";
            database: "ready";
        };
        RecordingResponse: {
            id: string;
            attempt_id: string | null;
            practice_session_id: string | null;
            media_type: string;
            byte_size: number;
            duration_ms: number;
            checksum_sha256: string;
            content_url: string;
            created_at: string;
            updated_at: string;
        };
        RestoreRequest: {
            filename: string;
        };
        RestoreScheduledResponse: {
            filename: string;
            will_restart: boolean;
        };
        ReviewQueueItem: {
            problem_id: number;
            title: string;
            topic: string;
            status: components["schemas"]["ProblemStatus"];
            due_in_days: number;
        };
        TopicFocusResponse: {
            topic: string;
            score: number;
            attempted: number;
            problem_count: number;
            due_count: number;
        };
        TranscriptionCapability: {
            enabled: boolean;
            available: boolean;
            model: string;
        };
        TranscriptionCorrection: {
            corrected_text: string;
        };
        TranscriptionResponse: {
            id: string;
            recording_id: string;
            status: components["schemas"]["TranscriptionStatus"];
            raw_text: string | null;
            corrected_text: string | null;
            segments: components["schemas"]["TranscriptionSegment"][];
            language: string | null;
            model: string | null;
            retry_count: number;
            error_code: string | null;
            error_message: string | null;
            started_at: string | null;
            completed_at: string | null;
            created_at: string;
            updated_at: string;
        };
        TranscriptionSegment: {
            start_seconds: number;
            end_seconds: number;
            text: string;
        };
        TranscriptionStatus: "queued" | "processing" | "completed" | "failed";
        ValidationError: {
            loc: (string | number)[];
            msg: string;
            type: string;
            input?: unknown;
            ctx?: Record<string, never>;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    live_api_v1_health_live_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
        };
    };
    ready_api_v1_health_ready_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReadinessResponse"];
                };
            };
        };
    };
    capabilities_api_v1_capabilities_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CapabilitiesResponse"];
                };
            };
        };
    };
    backup_status_api_v1_system_backups_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BackupStatusResponse"];
                };
            };
        };
    };
    backup_now_api_v1_system_backups_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BackupStatusResponse"];
                };
            };
        };
    };
    restore_backup_api_v1_system_backups_restore_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RestoreRequest"];
            };
        };
        responses: {
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RestoreScheduledResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    backup_files_api_v1_system_backups_files_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BackupFileListResponse"];
                };
            };
        };
    };
    remove_backup_api_v1_system_backups_files__filename__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                filename: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BackupFileListResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    prompt_templates_api_v1_settings_prompt_templates_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PromptTemplatesResponse"];
                };
            };
        };
    };
    save_prompt_template_api_v1_settings_prompt_templates__template_key__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_key: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PromptTemplateUpdate"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PromptTemplatesResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reset_saved_prompt_template_api_v1_settings_prompt_templates__template_key__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_key: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PromptTemplatesResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    interview_goals_api_v1_settings_interview_goals_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InterviewGoalsResponse"];
                };
            };
        };
    };
    save_interview_goals_api_v1_settings_interview_goals_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InterviewGoalsUpdate"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InterviewGoalsResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_data_api_v1_system_export_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExportResponse"];
                };
            };
        };
    };
    clear_data_api_v1_system_clear_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClearResponse"];
                };
            };
        };
    };
    problems_api_v1_problems_get: {
        parameters: {
            query?: {
                page?: number;
                page_size?: number;
                search?: string | null;
                difficulty?: components["schemas"]["Difficulty"] | null;
                status?: components["schemas"]["ProblemStatus"] | null;
                access?: components["schemas"]["ProblemAccess"];
                topic?: string | null;
                sort?: components["schemas"]["ProblemSort"];
                include_inactive?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemPage"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    problem_api_v1_problems__problem_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                problem_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetail"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    read_attempts_api_v1_attempts_get: {
        parameters: {
            query?: {
                problem_id?: number | null;
                offset?: number;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttemptListResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    read_problem_attempts_api_v1_problems__problem_id__attempts_get: {
        parameters: {
            query?: {
                offset?: number;
                limit?: number;
            };
            header?: never;
            path: {
                problem_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttemptListResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_problem_attempt_api_v1_problems__problem_id__attempts_post: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                problem_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AttemptCreate"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttemptResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    read_attempt_api_v1_attempts__attempt_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                attempt_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttemptResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    remove_attempt_api_v1_attempts__attempt_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                attempt_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    patch_attempt_api_v1_attempts__attempt_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                attempt_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AttemptUpdate"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttemptResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    remove_attempt_recording_api_v1_attempts__attempt_id__recording_delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                attempt_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    refresh_api_v1_catalog_refresh_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CatalogSyncResponse"];
                };
            };
        };
    };
    read_dashboard_api_v1_dashboard_get: {
        parameters: {
            query?: {
                range_days?: components["schemas"]["DashboardRange"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DashboardResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    review_queue_api_v1_review_queue_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReviewQueueItem"][];
                };
            };
        };
    };
    read_api_v1_jobs__job_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    start_api_v1_practice_sessions_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PracticeSessionCreate"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PracticeSessionResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    current_api_v1_practice_sessions_current_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PracticeSessionResponse"] | null;
                };
            };
        };
    };
    pause_api_v1_practice_sessions__session_id__pause_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PracticeSessionResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    resume_api_v1_practice_sessions__session_id__resume_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PracticeSessionResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    stop_api_v1_practice_sessions__session_id__stop_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "multipart/form-data": components["schemas"]["Body_stop_api_v1_practice_sessions__session_id__stop_post"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PracticeSessionResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    finalize_api_v1_practice_sessions__session_id__finalize_post: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PracticeSessionFinalize"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FinalizePracticeSessionResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    discard_api_v1_practice_sessions__session_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    content_api_v1_recordings__recording_id__content_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                recording_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    read_api_v1_attempts__attempt_id__transcription_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                attempt_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TranscriptionResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_api_v1_attempts__attempt_id__transcription_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                attempt_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TranscriptionResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    correct_api_v1_attempts__attempt_id__transcription_patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                attempt_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TranscriptionCorrection"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TranscriptionResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    retry_api_v1_attempts__attempt_id__transcription_retry_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                attempt_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TranscriptionResponse"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
}
