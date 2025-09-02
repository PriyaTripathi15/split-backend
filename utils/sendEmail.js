import nodemailer from "nodemailer";

export const sendInviteEmail = async ({ to, groupName, inviteLink }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail", // You can use other services or SMTP
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #2d3748;">You're Invited to Join a Group on <span style="color: #3182ce;">Split-IT</span> 💸</h2>
      <p>Hi there!</p>
      <p>You've been invited to join the group <strong>${groupName}</strong>.</p>
      <p>Click the button below to accept the invite and join the group:</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${inviteLink}" style="background-color: #3182ce; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 16px;">
          Join Group
        </a>
      </div>
      <p>If the button doesn't work, copy and paste the following link into your browser:</p>
      <p><a href="${inviteLink}">${inviteLink}</a></p>
      <hr/>
      <p style="font-size: 12px; color: #718096;">This invitation was sent by Split-IT. If you weren't expecting this, you can ignore it.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Split-IT" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Join the "${groupName}" group on Split-IT`,
    html: htmlContent,
  });
};
