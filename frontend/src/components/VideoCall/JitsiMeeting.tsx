import React, { useMemo } from 'react';

type JitsiMeetingProps = {
  meetingLink?: string;
  roomName?: string;
  userName?: string;
  token?: string;
  className?: string;
};

function normalizeUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, '');
}

function extractRoomName(meetingLink: string) {
  const cleaned = meetingLink.replace(/\/$/, '');
  return cleaned.substring(cleaned.lastIndexOf('/') + 1);
}

export default function JitsiMeeting({
  meetingLink,
  roomName,
  userName = 'Participant',
  token,
  className = '',
}: JitsiMeetingProps) {
  const iframeUrl = useMemo(() => {
    const defaultBaseUrl = 'http://localhost:8000';

    if (!meetingLink && !roomName) {
      return '';
    }

    const sourceLink = meetingLink || `${defaultBaseUrl}/${roomName}`;
    const baseMeetingUrl = normalizeUrl(sourceLink || defaultBaseUrl);
    const targetRoom = roomName || (meetingLink ? extractRoomName(meetingLink) : '');

    if (!targetRoom) {
      return '';
    }

    const basePath = `${baseMeetingUrl.substring(0, baseMeetingUrl.lastIndexOf('/'))}/${targetRoom}`;
    const params = new URLSearchParams();
    params.set('userInfo.displayName', userName);
    if (token) {
      params.set('jwt', token);
    }

    const hashParams = [
      'config.prejoinPageEnabled=false',
      'config.startWithAudioMuted=false',
      'config.startWithVideoMuted=false',
      'config.disableInviteFunctions=true',
      'interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=true',
      'interfaceConfig.HIDE_INVITE_MORE_HEADER=true',
      'interfaceConfig.TOOLBAR_BUTTONS=["microphone","camera","desktop","fullscreen","hangup","tileview"]',
    ].join('&');

    return `${basePath}?${params.toString()}#${hashParams}`;
  }, [meetingLink, roomName, token, userName]);

  if (!iframeUrl) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        No Jitsi room is available yet.
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-black ${className}`}>
      <iframe
        src={iframeUrl}
        title="Jitsi Meeting"
        allow="camera; microphone; display-capture; fullscreen; clipboard-read; clipboard-write"
        className="h-full min-h-[420px] w-full"
      />
    </div>
  );
}
