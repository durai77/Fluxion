const { createClient } = require("@supabase/supabase-js");

const storageBucket = process.env.SUPABASE_STORAGE_BUCKET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const signedUrlExpirySeconds = Number(process.env.SUPABASE_STORAGE_SIGNED_URL_EXPIRY || 900);

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function uploadEncryptedFile(fileBuffer, s3Key) {
  const { error } = await supabase.storage.from(storageBucket).upload(s3Key, fileBuffer, {
    contentType: "application/octet-stream",
    upsert: false,
  });
  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }
}

async function getDownloadUrl(s3Key) {
  const { data, error } = await supabase.storage
    .from(storageBucket)
    .createSignedUrl(s3Key, signedUrlExpirySeconds);
  if (error) {
    throw new Error(`Supabase signed URL failed: ${error.message}`);
  }
  return data.signedUrl;
}

async function deleteEncryptedFile(s3Key) {
  const { error } = await supabase.storage.from(storageBucket).remove([s3Key]);
  if (error) {
    throw new Error(`Supabase delete failed: ${error.message}`);
  }
}

module.exports = {
  uploadEncryptedFile,
  getDownloadUrl,
  deleteEncryptedFile,
};
