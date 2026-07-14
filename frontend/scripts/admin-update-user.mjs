// One-off admin script: directly set a Supabase user's email and/or password,
// bypassing the dashboard UI and any email confirmation step.
//
// Usage (PowerShell), run from frontend/ so it can find @supabase/supabase-js:
//
//   $env:SUPABASE_URL = "https://your-project-ref.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY = "paste-service-role-key-here"
//   node scripts/admin-update-user.mjs <user-uid> <new-email> <new-password>
//
// The service_role key is never written to disk or committed - it only lives
// in this terminal session's environment variables.

import { createClient } from '@supabase/supabase-js'

const [, , userId, newEmail, newPassword] = process.argv

if (!userId || (!newEmail && !newPassword)) {
  console.error('Usage: node scripts/admin-update-user.mjs <user-uid> <new-email> [new-password]')
  process.exit(1)
}

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const updates = {}
if (newEmail) updates.email = newEmail
if (newPassword) updates.password = newPassword
updates.email_confirm = true

const { data, error } = await supabase.auth.admin.updateUserById(userId, updates)

if (error) {
  console.error('Failed:', error.message)
  process.exit(1)
}

console.log('Updated user:', data.user.email)
