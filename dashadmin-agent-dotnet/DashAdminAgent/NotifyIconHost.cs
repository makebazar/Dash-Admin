using System;
using System.Drawing;
using System.Windows.Forms;

namespace DashAdminAgent;

public sealed class NotifyIconHost : IDisposable
{
    private readonly NotifyIcon _notify;
    private readonly Action _onShow;
    private readonly Action _onExit;

    public NotifyIconHost(Action onShow, Action onExit)
    {
        _onShow = onShow;
        _onExit = onExit;

        _notify = new NotifyIcon
        {
            Text = "DashAdmin Агент",
            Icon = SystemIcons.Application,
            Visible = true
        };

        _notify.DoubleClick += (_, _) => _onShow();

        var menu = new ContextMenuStrip();
        menu.Items.Add("Открыть", null, (_, _) => _onShow());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Выход", null, (_, _) => _onExit());
        _notify.ContextMenuStrip = menu;
    }

    public void ShowBalloon(string title, string text)
    {
        _notify.BalloonTipTitle = title;
        _notify.BalloonTipText = text;
        _notify.ShowBalloonTip(1200);
    }

    public void Dispose()
    {
        _notify.Visible = false;
        _notify.Dispose();
    }
}
