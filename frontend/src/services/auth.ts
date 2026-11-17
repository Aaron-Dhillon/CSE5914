import { request } from './api'

export interface LoginResponse {
  token: string
  user: { user_id: string; email: string }
}
export interface ProfileResponse {
  id: string
  email: string
  verified: boolean
  display_name: string | null
  birth_date: string | null
  graduation_year: number | null
  major: string | null
  has_car: boolean | null
  bio: string | null
}

export interface UpdateProfileRequest {
  id: string
  display_name: string
  birth_date: string | null
  graduation_year: number | null
  major: string
  has_car: boolean
  bio: string
}

export async function login(email: string, password: string) {
  return request('/account/login', { method: 'POST', body: { email, password } }) as Promise<LoginResponse>
}

export async function register(email: string, password: string) {
  return request('/account/create_account', { method: 'POST', body: { email, password } })
}

export async function resendVerification(email: string) {
  return request('/account/resend_verification_email', { method: 'POST', body: { email } })
}

export async function verifyToken(token: string, user_email: string) {
  return request(`/account/verify_token?token=${encodeURIComponent(token)}&user_email=${encodeURIComponent(user_email)}`)
}

export async function getProfile(id: string) {
  return request(`/account/profile?id=${encodeURIComponent(id)}`) as Promise<ProfileResponse>
}

export async function updateProfile(profile: UpdateProfileRequest) {
  return request('/account/profile', { method: 'PUT', body: profile }) as Promise<ProfileResponse>
}

export function deleteAccount(password: string) {
  return request('/account/delete_account', { method: 'DELETE', body: { password } })
}
