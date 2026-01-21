import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  try {
    const { error } = await resend.emails.send({
      from: 'Sleck <onboarding@resend.dev>',
      to: email,
      subject: 'パスワードリセットのご案内 - Sleck',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #611f69;">Sleck</h1>
          <h2>パスワードリセット</h2>
          <p>パスワードリセットのリクエストを受け付けました。</p>
          <p>以下のボタンをクリックして、新しいパスワードを設定してください：</p>
          <p style="margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #611f69; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              パスワードをリセット
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            このリンクは1時間後に期限切れになります。
          </p>
          <p style="color: #666; font-size: 14px;">
            このメールに心当たりがない場合は、無視してください。
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">
            © Sleck
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send email:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Email service error:', error)
    return false
  }
}
