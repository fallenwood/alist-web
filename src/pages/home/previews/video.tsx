import { Box } from "@hope-ui/solid"
import { createSignal, onCleanup, onMount } from "solid-js"
import { useRouter, useLink } from "~/hooks"
import { getSettingBool, objStore } from "~/store"
import { Obj, ObjType } from "~/types"
import { ext } from "~/utils"
import Artplayer from "artplayer"
import { type Option } from "artplayer/types/option"
import artplayerPluginDanmuku from "artplayer-plugin-danmuku"
import flvjs from "flv.js"
import Hls from "hls.js"
import { currentLang } from "~/app/i18n"
import { VideoBox } from "./video_box"
import axios from "axios"

const Red = "red"

const fetchDandanplayDanmaku = (obj: Obj) => {
  // console.log(obj.name);
  const data = {
    fileName: obj.name.replace(/\.[^/.]+$/, ""),
    fileSize: obj.size,
    // Dummy hash to pass dandanplay api argument check
    fileHash: "658d05841b9476ccc7420b3f0bb21c3b",
    matchMode: "fileNameOnly",
  }
  const config = {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  }

  const danmaku: () => Promise<any> = async function () {
    try {
      const resp = await axios.post(
        "https://api.dandanplay.net/api/v2/match",
        data,
        config,
      )
      const d = resp.data
      const match = d["matches"][0]
      const match_name = `${match["animeTitle"]} - ${match["episodeTitle"]}`
      const episode_id = match["episodeId"]

      // chConvert 0 - 不转换，1 - 转换为简体，2 - 转换为繁体。
      // withRelated 是否同时获取关联的第三方弹幕。默认值为 false
      const danmaku_resp = await axios.get(
        `https://api.dandanplay.net/api/v2/comment/${episode_id}?withRelated=true&chConvert=0`,
        config,
      )
      const danmaku: Array<any> = danmaku_resp.data["comments"]

      let cvt_danmaku = danmaku.map((e) => {
        // <d p="23.826000213623,1,25,16777215,1422201084,0,057075e9,757076900">我从未见过如此厚颜无耻之猴</d>
        // 0:时间(弹幕出现时间)
        // 1:类型(1从右至左滚动弹幕|6从左至右滚动弹幕|5顶端固定弹幕|4底端固定弹幕|7高级弹幕|8脚本弹幕)
        // 2:字号
        // 3:颜色
        // 4:时间戳 ?  // 5:弹幕池id // 6:用户hash // 7:弹幕id
        const p = e.p.split(",")
        return {
          text: e.m || "",
          time: Number(p[0]),
          color: p[3],
          border: false,
          mode: p[1] == 5 || p[1] == 4 ? 1 : 0,
        }
      })

      cvt_danmaku = [
        {
          text: `当前加载的弹幕：`,
          time: 0,
          color: Red,
          border: false,
          mode: 1,
        },
        {
          text: match_name,
          time: 0,
          color: Red,
          border: false,
          mode: 1,
        },
        ...cvt_danmaku,
      ]
      // console.log(cvt_danmaku);
      return cvt_danmaku
    } catch {
      return [
        {
          text: "加载弹幕失败了捏",
          time: 0,
          color: Red,
          border: false,
          mode: 1,
        },
      ]
    }
  }

  return danmaku
}

const Preview = () => {
  const { replace, pathname } = useRouter()
  const { proxyLink } = useLink()
  let videos = objStore.objs.filter((obj) => obj.type === ObjType.VIDEO)
  if (videos.length === 0) {
    videos = [objStore.obj]
  }
  let player: Artplayer
  let option: Option = {
    id: pathname(),
    container: "#video-player",
    url: objStore.raw_url,
    title: objStore.obj.name,
    volume: 0.5,
    autoplay: getSettingBool("video_autoplay"),
    autoSize: false,
    autoMini: true,
    loop: false,
    flip: true,
    playbackRate: true,
    aspectRatio: true,
    setting: true,
    hotkey: true,
    pip: true,
    mutex: true,
    fullscreen: true,
    fullscreenWeb: true,
    subtitleOffset: true,
    miniProgressBar: false,
    playsInline: true,
    // layers: [],
    // settings: [],
    // contextmenu: [],
    // controls: [],
    quality: [],
    // highlight: [],
    plugins: [],
    whitelist: [],
    // subtitle:{}
    moreVideoAttr: {
      // @ts-ignore
      "webkit-playsinline": true,
      playsInline: true,
    },
    type: ext(objStore.obj.name),
    customType: {
      flv: function (video: HTMLMediaElement, url: string) {
        const flvPlayer = flvjs.createPlayer(
          {
            type: "flv",
            url: url,
          },
          { referrerPolicy: "same-origin" },
        )
        flvPlayer.attachMediaElement(video)
        flvPlayer.load()
      },
      m3u8: function (video: HTMLMediaElement, url: string) {
        const hls = new Hls()
        hls.loadSource(url)
        hls.attachMedia(video)
        if (!video.src) {
          video.src = url
        }
      },
    },
    lang: ["en", "zh-cn", "zh-tw"].includes(currentLang().toLowerCase())
      ? (currentLang().toLowerCase() as any)
      : "en",
    lock: true,
    fastForward: true,
    autoPlayback: true,
    autoOrientation: true,
    airplay: true,
  }
  const subtitle = objStore.related.find((obj) => {
    for (const ext of [".srt", ".ass", ".vtt"]) {
      if (obj.name.endsWith(ext)) {
        return true
      }
    }
    return false
  })
  const danmu = objStore.related.find((obj) => {
    for (const ext of [".xml"]) {
      if (obj.name.endsWith(ext)) {
        return true
      }
    }
    return false
  })

  const dandanplayDanmakuEnabled = getSettingBool("dandanplay_danmaku_enabled")

  if (subtitle) {
    option.subtitle = {
      url: proxyLink(subtitle, true),
      type: ext(subtitle.name) as any,
    }
  }
  if (dandanplayDanmakuEnabled || danmu) {
    const danmuku = dandanplayDanmakuEnabled
      ? fetchDandanplayDanmaku(objStore.obj)
      : proxyLink(danmu!, true)

    option.plugins = [
      artplayerPluginDanmuku({
        danmuku,
        speed: 5,
        opacity: 1,
        fontSize: 25,
        color: "#FFFFFF",
        mode: 0,
        margin: [0, "0%"],
        antiOverlap: false,
        useWorker: true,
        synchronousPlayback: false,
        lockTime: 5,
        maxLength: 100,
        minWidth: 200,
        maxWidth: 400,
        theme: "dark",
      }),
    ]
  }

  onMount(() => {
    player = new Artplayer(option)
    player.on("video:ended", () => {
      if (!autoNext()) return
      const index = videos.findIndex((f) => f.name === objStore.obj.name)
      if (index < videos.length - 1) {
        replace(videos[index + 1].name)
      }
    })
  })
  onCleanup(() => {
    player?.destroy()
  })
  const [autoNext, setAutoNext] = createSignal()
  return (
    <VideoBox onAutoNextChange={setAutoNext}>
      <Box w="$full" h="60vh" id="video-player" />
    </VideoBox>
  )
}

export default Preview
