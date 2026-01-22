import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Warning: SUPABASE_URL or SUPABASE_SERVICE_KEY not set. Avatar uploads will fail.')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const BUCKET_NAME = 'avatars'

export async function uploadAvatar(
  userId: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const ext = mimeType.split('/')[1] || 'jpg'
  const fileName = `${userId}-${Date.now()}.${ext}`
  const filePath = `${fileName}`

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    })

  if (error) {
    throw new Error(`Failed to upload avatar: ${error.message}`)
  }

  // Get public URL
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath)

  return data.publicUrl
}

export async function deleteAvatar(avatarUrl: string): Promise<void> {
  // Extract file path from URL
  const urlParts = avatarUrl.split(`/storage/v1/object/public/${BUCKET_NAME}/`)
  if (urlParts.length < 2) return

  const filePath = urlParts[1]

  await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath])
}
