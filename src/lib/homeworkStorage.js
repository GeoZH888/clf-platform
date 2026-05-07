// src/lib/homeworkStorage.js
// Helpers for uploading homework prompts (teacher) + responses (student)
// to Supabase Storage bucket 'homework-files'.
import { supabase } from '../school/services/supabase';

const BUCKET = 'homework-files';

// Upload a teacher prompt file. homeworkId must already exist.
export async function uploadHomeworkPrompt(homeworkId, file) {
  const safe = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
  const ts = Date.now();
  const path = `prompts/${homeworkId}/${ts}_${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data: signed } = await supabase.storage.from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
  return { path, url: signed?.signedUrl, name: file.name };
}

// Upload a student response file. submissionId must already exist.
export async function uploadStudentResponse(submissionId, file, kind) {
  const safe = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
  const ts = Date.now();
  const path = `responses/${submissionId}/${kind}_${ts}_${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data: signed } = await supabase.storage.from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  return { path, url: signed?.signedUrl, name: file.name };
}

// Refresh a signed URL for an existing path
export async function refreshSignedUrl(path) {
  const { data } = await supabase.storage.from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl;
}
